import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FindOperator, Repository } from 'typeorm';
import { celdaCsv, SolicitudService } from './solicitud.service';
import { Solicitud } from './entities/solicitud.entity';
import { ModeloCasa } from '../modeloCasa/entities/modeloCasa.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Reserva } from '../reserva/entities/reserva.entity';

describe('SolicitudService', () => {
  let solicitudRepo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock; delete: jest.Mock; createQueryBuilder: jest.Mock };
  let modeloRepo: { findOne: jest.Mock };
  let reservaRepo: { exists: jest.Mock; find: jest.Mock };
  let auditoria: { registrar: jest.Mock };
  let qb: Record<'delete' | 'where' | 'execute', jest.Mock>;
  let service: SolicitudService;
  const dto = {
    nombre: 'Juan', apellido: 'Pérez', correo: 'j@p.cl', celular: '+56911111111',
    id_modelo_casa: '11111111-1111-4111-8111-111111111111', aceptaPrivacidad: true,
  };

  function crear(config: Record<string, string> = {}) {
    service = new SolicitudService(
      solicitudRepo as unknown as Repository<Solicitud>,
      modeloRepo as unknown as Repository<ModeloCasa>,
      new ConfigService(config),
      auditoria as unknown as AuditoriaService,
      reservaRepo as unknown as Repository<Reserva>,
    );
  }

  beforeEach(() => {
    qb = { delete: jest.fn(), where: jest.fn(), execute: jest.fn().mockResolvedValue({ affected: 2 }) };
    qb.delete.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    solicitudRepo = {
      findOne: jest.fn(), find: jest.fn(), save: jest.fn(async (x) => x),
      delete: jest.fn(), createQueryBuilder: jest.fn(() => qb),
    };
    modeloRepo = { findOne: jest.fn() };
    reservaRepo = { exists: jest.fn().mockResolvedValue(false), find: jest.fn().mockResolvedValue([]) };
    auditoria = { registrar: jest.fn() };
    crear();
  });

  it('guarda el mensaje en "mensaje" y la fecha de consentimiento', async () => {
    modeloRepo.findOne.mockResolvedValue({ id: 'm1' });
    const s = await service.crearSolicitud({ ...dto, mensaje: 'Hola' });
    expect(s.mensaje).toBe('Hola');
    expect(s.consentimientoEn).toBeInstanceOf(Date);
    expect(s.modeloCasa).toEqual({ id: 'm1' });
  });

  it('mensaje ausente se guarda como null', async () => {
    modeloRepo.findOne.mockResolvedValue({ id: 'm1' });
    const s = await service.crearSolicitud(dto);
    expect(s.mensaje).toBeNull();
  });

  it('solo acepta modelos activos de proyectos activos', async () => {
    modeloRepo.findOne.mockResolvedValue({ id: 'm1' });
    await service.crearSolicitud(dto);
    expect(modeloRepo.findOne).toHaveBeenCalledWith({
      where: { id: dto.id_modelo_casa, activo: true, proyecto: { activo: true } },
    });
  });

  describe('visita preferida', () => {
    const conSala = { id: 'm1', proyecto: { salaDireccion: '1 Sur 100, Talca' } };
    const enDias = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();

    it('sin visita se guarda null', async () => {
      modeloRepo.findOne.mockResolvedValue(conSala);
      expect((await service.crearSolicitud(dto)).visitaPreferida).toBeNull();
    });

    it('guarda una fecha futura dentro de 60 días si el proyecto tiene sala', async () => {
      modeloRepo.findOne.mockResolvedValue(conSala);
      const visita = enDias(3);
      const s = await service.crearSolicitud({ ...dto, visitaPreferida: visita });
      expect(s.visitaPreferida).toEqual(new Date(visita));
    });

    it.each([
      ['pasada', -1],
      ['más allá de 60 días', 61],
    ])('400 con una fecha %s', async (_caso, dias) => {
      modeloRepo.findOne.mockResolvedValue(conSala);
      await expect(service.crearSolicitud({ ...dto, visitaPreferida: enDias(dias) })).rejects.toBeInstanceOf(BadRequestException);
      expect(solicitudRepo.save).not.toHaveBeenCalled();
    });

    it('400 si el proyecto no tiene sala de ventas', async () => {
      modeloRepo.findOne.mockResolvedValue({ id: 'm1', proyecto: { salaDireccion: null } });
      await expect(service.crearSolicitud({ ...dto, visitaPreferida: enDias(3) })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('404 si el modelo de casa no existe', async () => {
    modeloRepo.findOne.mockResolvedValue(null);
    await expect(service.crearSolicitud(dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marcarContactado pone contactado=true', async () => {
    solicitudRepo.findOne.mockResolvedValue({ id: 's1', contactado: false });
    const s = await service.marcarContactado('s1');
    expect(s.contactado).toBe(true);
  });

  it('marcarContactado 404 si no existe', async () => {
    solicitudRepo.findOne.mockResolvedValue(null);
    await expect(service.marcarContactado('s1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('eliminarSolicitud borra por id y da 404 si no existía', async () => {
    solicitudRepo.delete.mockResolvedValueOnce({ affected: 1 });
    await service.eliminarSolicitud('s1');
    expect(solicitudRepo.delete).toHaveBeenCalledWith({ id: 's1' });

    solicitudRepo.delete.mockResolvedValueOnce({ affected: 0 });
    await expect(service.eliminarSolicitud('s2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('eliminarPorCorreo compara exacto sin mayúsculas (sin LIKE) y devuelve cuántas borró', async () => {
    const res = await service.eliminarPorCorreo('J_P@p.cl');
    expect(qb.where).toHaveBeenCalledWith('LOWER(correo) = LOWER(:correo)', { correo: 'J_P@p.cl' });
    expect(res).toEqual({ eliminadas: 2 });
  });

  describe('exportarCsv', () => {
    const usuario = { id: 'u1', correo: 'a@x.cl', rol: 'SECRETARIO' };

    it('genera CSV con BOM y ";", escapa comillas y saltos, y audita la exportación', async () => {
      solicitudRepo.find.mockResolvedValue([{
        creadoEn: new Date('2026-10-01T12:00:00Z'), nombre: 'Ana', apellido: 'Díaz', correo: 'a@b.cl', celular: '+56 9 1111 1111',
        mensaje: 'Hola; "quiero"\nvisitar', contactado: false, visitaPreferida: null,
        modeloCasa: { nombreModelo: 'Casa A', proyecto: { nombre: 'Los Robles' } },
      }, {
        creadoEn: new Date('2026-10-02T12:00:00Z'), nombre: 'Luis', apellido: 'Soto', correo: 'l@s.cl', celular: '+56922222222',
        mensaje: null, contactado: true, visitaPreferida: new Date('2026-10-10T18:30:00Z'),
        modeloCasa: { nombreModelo: 'Casa B', proyecto: { nombre: 'Los Robles' } },
      }]);

      const csv = await service.exportarCsv(usuario);

      expect(csv.split('\r\n')[0]).toBe('﻿Fecha;Nombre;Apellido;Correo;Celular;Proyecto;Modelo;Mensaje;Estado;Visita preferida');
      expect(csv.split('\r\n')[1]).toBe(
        '2026-10-01T12:00:00.000Z;Ana;Díaz;a@b.cl;+56 9 1111 1111;Los Robles;Casa A;"Hola; ""quiero""\nvisitar";Pendiente;',
      );
      expect(csv.split('\r\n')[2]).toBe('2026-10-02T12:00:00.000Z;Luis;Soto;l@s.cl;+56922222222;Los Robles;Casa B;;Contactado;2026-10-10T18:30:00.000Z');
      expect(auditoria.registrar).toHaveBeenCalledWith({
        accion: 'EXPORTAR_SOLICITUDES', exito: true, idUsuario: 'u1', correo: 'a@x.cl', rol: 'SECRETARIO', detalle: { cantidad: 2 },
      });
    });

    it.each([
      ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
      ['@SUM(1)', "'@SUM(1)"],
      ['+1+cmd', "'+1+cmd"],
      ['-2+3', "'-2+3"],
      ['+56911111111', '+56911111111'],
      ['texto', 'texto'],
    ])('neutraliza fórmulas: %s', (valor, esperado) => {
      expect(celdaCsv(valor)).toBe(esperado);
    });
  });

  describe('retención', () => {
    function fechaLimite(): Date {
      const operador = solicitudRepo.delete.mock.calls[0][0].creadoEn as FindOperator<Date>;
      expect(operador.type).toBe('lessThan');
      return operador.value as Date;
    }

    it('borra las solicitudes más antiguas que 365 días por defecto y lo audita', async () => {
      solicitudRepo.delete.mockResolvedValue({ affected: 3 });
      const antes = Date.now();

      expect(await service.eliminarVencidas()).toBe(3);

      const dias = (antes - fechaLimite().getTime()) / 86_400_000;
      expect(dias).toBeCloseTo(365, 2);
      expect(auditoria.registrar).toHaveBeenCalledWith({
        accion: 'RETENCION_SOLICITUDES', exito: true, detalle: { dias: 365, eliminadas: 3 },
      });
    });

    it('respeta SOLICITUD_RETENCION_DIAS', async () => {
      crear({ SOLICITUD_RETENCION_DIAS: '30' });
      solicitudRepo.delete.mockResolvedValue({ affected: 0 });
      await service.eliminarVencidas();
      expect((Date.now() - fechaLimite().getTime()) / 86_400_000).toBeCloseTo(30, 2);
    });

    it('excluye las solicitudes con reserva activa o venta', async () => {
      reservaRepo.find.mockResolvedValue([{ solicitud: { id: 's9' } }, { solicitud: { id: 's8' } }]);
      solicitudRepo.delete.mockResolvedValue({ affected: 1 });
      await service.eliminarVencidas();
      const id = solicitudRepo.delete.mock.calls[0][0].id as FindOperator<unknown>;
      expect(id.type).toBe('not');
      expect(JSON.stringify(id)).toContain('s9');
      expect(JSON.stringify(id)).toContain('s8');
    });

    it('sin reservas activas no filtra por id', async () => {
      solicitudRepo.delete.mockResolvedValue({ affected: 0 });
      await service.eliminarVencidas();
      expect(solicitudRepo.delete.mock.calls[0][0].id).toBeUndefined();
    });
  });

  describe('solicitudes con reserva activa', () => {
    const MENSAJE = 'La solicitud tiene una reserva activa o una venta; sus datos se conservan para ejecutar el contrato. Si la reserva se anula, se podrá eliminar.';

    it('eliminarSolicitud responde 409 y no borra', async () => {
      reservaRepo.exists.mockResolvedValue(true);
      await expect(service.eliminarSolicitud('s1')).rejects.toThrow(new ConflictException(MENSAJE));
      expect(solicitudRepo.delete).not.toHaveBeenCalled();
    });

    it('eliminarPorCorreo responde 409 sin borrar nada, comparando el correo sin mayúsculas', async () => {
      reservaRepo.exists.mockResolvedValue(true);
      await expect(service.eliminarPorCorreo('J@P.cl')).rejects.toThrow(new ConflictException(MENSAJE));
      expect(qb.execute).not.toHaveBeenCalled();
      const correo = reservaRepo.exists.mock.calls[0][0].where.solicitud.correo as FindOperator<unknown>;
      expect(correo.type).toBe('raw');
      expect(correo.getSql?.('"correo"')).toBe('LOWER("correo") = LOWER(:correo)');
      expect(correo.objectLiteralParameters).toEqual({ correo: 'J@P.cl' });
    });

    it('la bandeja y el detalle traen las reservas', async () => {
      solicitudRepo.findOne.mockResolvedValue({ id: 's1' });
      await service.mostrarSolicitudes();
      await service.obtenerSolicitud('s1');
      expect(solicitudRepo.find.mock.calls[0][0].relations).toMatchObject({ reservas: true });
      expect(solicitudRepo.findOne.mock.calls[0][0].relations).toMatchObject({ reservas: true });
    });
  });
});
