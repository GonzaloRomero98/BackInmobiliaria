import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FindOperator, In, IsNull, Not, Repository } from 'typeorm';
import { celdaCsv, SolicitudService } from './solicitud.service';
import { Solicitud } from './entities/solicitud.entity';
import { ModeloCasa } from '../modeloCasa/entities/modeloCasa.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Reserva } from '../reserva/entities/reserva.entity';
import { NotaSolicitud } from './entities/notaSolicitud.entity';
import { Cotizacion } from './entities/cotizacion.entity';

describe('SolicitudService', () => {
  let solicitudRepo: { exists: jest.Mock; findOne: jest.Mock; find: jest.Mock; findAndCount: jest.Mock; count: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let modeloRepo: { findOne: jest.Mock };
  let reservaRepo: { exists: jest.Mock; find: jest.Mock };
  let auditoria: { registrar: jest.Mock };
  let notaRepo: { find: jest.Mock; save: jest.Mock; create: jest.Mock };
  let cotizacionRepo: { find: jest.Mock; save: jest.Mock; create: jest.Mock };
  let manager: { save: jest.Mock; create: jest.Mock; find: jest.Mock; delete: jest.Mock; createQueryBuilder: jest.Mock };
  let qbReserva: Record<'delete' | 'from' | 'where' | 'execute', jest.Mock>;
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
      notaRepo as unknown as Repository<NotaSolicitud>,
      cotizacionRepo as unknown as Repository<Cotizacion>,
    );
  }

  beforeEach(() => {
    solicitudRepo = {
      exists: jest.fn(), findOne: jest.fn(), find: jest.fn(), save: jest.fn(async (x) => x),
      findAndCount: jest.fn(async () => [[], 0]), count: jest.fn(async () => 0),
      delete: jest.fn(),
    };
    qbReserva = { delete: jest.fn(), from: jest.fn(), where: jest.fn(), execute: jest.fn().mockResolvedValue({ affected: 0 }) };
    for (const paso of ['delete', 'from', 'where'] as const) qbReserva[paso].mockReturnValue(qbReserva);
    manager = {
      save: jest.fn(async (x) => x), create: jest.fn((_entidad, x) => x),
      find: jest.fn(async () => [{ id: 's1' }, { id: 's2' }]), delete: jest.fn(async () => ({ affected: 2 })),
      createQueryBuilder: jest.fn(() => qbReserva),
    };
    Object.assign(solicitudRepo, { manager: { transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)) } });
    notaRepo = { find: jest.fn(async () => []), save: jest.fn(async (x) => x), create: jest.fn((x) => x) };
    cotizacionRepo = { find: jest.fn(async () => []), save: jest.fn(async (x) => x), create: jest.fn((x) => x) };
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

  describe('borrado de solicitudes', () => {
    it('eliminarSolicitud borra por id, primero sus reservas anuladas, y da 404 si no existía', async () => {
      manager.find.mockResolvedValueOnce([{ id: 's1' }]);
      manager.delete.mockResolvedValueOnce({ affected: 1 });
      await service.eliminarSolicitud('s1');
      expect(manager.find).toHaveBeenCalledWith(Solicitud, expect.objectContaining({ where: { id: 's1' } }));
      expect(qbReserva.from).toHaveBeenCalledWith(Reserva);
      expect(qbReserva.where).toHaveBeenCalledWith('id_solicitud IN (:...ids) AND estado = :anulada', { ids: ['s1'], anulada: 'ANULADA' });
      expect(manager.delete).toHaveBeenCalledWith(Solicitud, { id: In(['s1']) });
      expect(qbReserva.execute.mock.invocationCallOrder[0]).toBeLessThan(manager.delete.mock.invocationCallOrder[0]);

      manager.find.mockResolvedValueOnce([]);
      await expect(service.eliminarSolicitud('s2')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('eliminarPorCorreo compara exacto sin mayúsculas (sin LIKE) y devuelve cuántas borró', async () => {
      const res = await service.eliminarPorCorreo('J_P@p.cl');
      const correo = manager.find.mock.calls[0][1].where.correo as FindOperator<unknown>;
      expect(correo.type).toBe('raw');
      expect(correo.getSql?.('"correo"')).toBe('LOWER("correo") = LOWER(:correo)');
      expect(correo.objectLiteralParameters).toEqual({ correo: 'J_P@p.cl' });
      expect(res).toEqual({ eliminadas: 2 });
    });

    it('sin solicitudes que borrar no toca las reservas', async () => {
      manager.find.mockResolvedValueOnce([]);
      expect(await service.eliminarPorCorreo('nadie@x.cl')).toEqual({ eliminadas: 0 });
      expect(qbReserva.execute).not.toHaveBeenCalled();
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('otros errores de la BD no se disfrazan de 409', async () => {
      manager.delete.mockRejectedValueOnce(new Error('conexión perdida'));
      await expect(service.eliminarSolicitud('s1')).rejects.toThrow('conexión perdida');
    });
  });

  describe('exportarCsv', () => {
    const usuario = { id: 'u1', correo: 'a@x.cl', rol: 'SECRETARIO' };

    it('genera CSV con BOM y ";", escapa comillas y saltos, y audita la exportación', async () => {
      solicitudRepo.find.mockResolvedValue([{
        creadoEn: new Date('2026-10-01T12:00:00Z'), nombre: 'Ana', apellido: 'Díaz', correo: 'a@b.cl', celular: '+56 9 1111 1111',
        mensaje: 'Hola; "quiero"\nvisitar', contactado: false, visitaPreferida: null, visitaEstado: null, origen: 'WEB',
        modeloCasa: { nombreModelo: 'Casa A', proyecto: { nombre: 'Los Robles' } },
      }, {
        creadoEn: new Date('2026-10-02T12:00:00Z'), nombre: 'Luis', apellido: 'Soto', correo: 'l@s.cl', celular: '+56922222222',
        mensaje: null, contactado: true, visitaPreferida: new Date('2026-10-10T18:30:00Z'), visitaEstado: 'CONFIRMADA', origen: 'TELEFONO',
        modeloCasa: { nombreModelo: 'Casa B', proyecto: { nombre: 'Los Robles' } },
      }]);

      const csv = await service.exportarCsv(usuario);

      expect(csv.split('\r\n')[0]).toBe('﻿Fecha;Nombre;Apellido;Correo;Celular;Proyecto;Modelo;Mensaje;Estado;Visita preferida;Estado visita;Origen');
      expect(csv.split('\r\n')[1]).toBe(
        '2026-10-01T12:00:00.000Z;Ana;Díaz;a@b.cl;+56 9 1111 1111;Los Robles;Casa A;"Hola; ""quiero""\nvisitar";Pendiente;;;Web',
      );
      expect(csv.split('\r\n')[2]).toBe('2026-10-02T12:00:00.000Z;Luis;Soto;l@s.cl;+56922222222;Los Robles;Casa B;;Contactado;2026-10-10T18:30:00.000Z;Confirmada;Teléfono');
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
    const condicion = () => manager.find.mock.calls[0][1].where;
    function fechaLimite(): Date {
      const operador = condicion().creadoEn as FindOperator<Date>;
      expect(operador.type).toBe('lessThan');
      return operador.value as Date;
    }

    it('borra las solicitudes más antiguas que 365 días por defecto y lo audita', async () => {
      manager.delete.mockResolvedValue({ affected: 3 });
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
      await service.eliminarVencidas();
      expect((Date.now() - fechaLimite().getTime()) / 86_400_000).toBeCloseTo(30, 2);
    });

    it('excluye las solicitudes con reserva activa o venta', async () => {
      reservaRepo.find.mockResolvedValue([{ solicitud: { id: 's9' } }, { solicitud: { id: 's8' } }]);
      await service.eliminarVencidas();
      const id = condicion().id as FindOperator<unknown>;
      expect(id.type).toBe('not');
      expect(JSON.stringify(id)).toContain('s9');
      expect(JSON.stringify(id)).toContain('s8');
    });

    it('sin reservas activas no filtra por id', async () => {
      await service.eliminarVencidas();
      expect(condicion().id).toBeUndefined();
    });
  });

  describe('solicitudes con reserva activa', () => {
    const MENSAJE = 'La solicitud tiene una reserva activa o una venta; sus datos se conservan para ejecutar el contrato. Si la reserva se anula, se podrá eliminar.';
    // Así responde Postgres cuando el FK sin cascada impide borrar una solicitud con reservas.
    const errorFk = Object.assign(new Error('violates foreign key constraint'), { code: '23503', constraint: 'FK_reserva_solicitud' });

    it('eliminarSolicitud responde 409 si la BD rechaza el borrado por una reserva', async () => {
      manager.delete.mockRejectedValueOnce(errorFk);
      await expect(service.eliminarSolicitud('s1')).rejects.toThrow(new ConflictException(MENSAJE));
    });

    it('eliminarPorCorreo responde 409 si cualquiera de sus solicitudes tiene una reserva', async () => {
      manager.delete.mockRejectedValueOnce(errorFk);
      await expect(service.eliminarPorCorreo('J@P.cl')).rejects.toThrow(new ConflictException(MENSAJE));
    });

    it('la bandeja, el CSV y el detalle traen las reservas', async () => {
      solicitudRepo.findOne.mockResolvedValue({ id: 's1' });
      await service.listarSolicitudes({ pagina: 1, limite: 20, filtro: 'todas' });
      await service.mostrarSolicitudes();
      await service.obtenerSolicitud('s1');
      expect(solicitudRepo.findAndCount.mock.calls[0][0].relations).toMatchObject({ reservas: true });
      expect(solicitudRepo.find.mock.calls[0][0].relations).toMatchObject({ reservas: true });
      expect(solicitudRepo.findOne.mock.calls[0][0].relations).toMatchObject({ reservas: true });
    });
  });

  describe('bandeja paginada', () => {
    it('salta las páginas anteriores, ordena de forma estable y devuelve totales', async () => {
      solicitudRepo.findAndCount.mockResolvedValue([[{ id: 's21' }], 45]);
      solicitudRepo.count.mockResolvedValue(7);
      const res = await service.listarSolicitudes({ pagina: 3, limite: 20, filtro: 'todas' });
      expect(res).toEqual({ solicitudes: [{ id: 's21' }], total: 45, pendientes: 7, pagina: 3, limite: 20 });
      expect(solicitudRepo.findAndCount.mock.calls[0][0]).toMatchObject({ skip: 40, take: 20, order: { creadoEn: 'DESC', id: 'ASC' }, where: {} });
      expect(solicitudRepo.count).toHaveBeenCalledWith({ where: { contactado: false } });
    });

    it.each([
      ['pendientes', { contactado: false }],
      ['contactados', { contactado: true }],
    ] as const)('filtro %s va en la consulta', async (filtro, where) => {
      await service.listarSolicitudes({ pagina: 1, limite: 20, filtro });
      expect(solicitudRepo.findAndCount.mock.calls[0][0].where).toEqual(where);
    });

    it('filtro visita pide visitaPreferida no nula', async () => {
      await service.listarSolicitudes({ pagina: 1, limite: 20, filtro: 'visita' });
      expect(solicitudRepo.findAndCount.mock.calls[0][0].where).toEqual({ visitaPreferida: Not(IsNull()) });
    });

    it('buscar: cada palabra debe aparecer (AND), escapa comodines y se combina con el filtro', async () => {
      await service.listarSolicitudes({ pagina: 1, limite: 20, filtro: 'pendientes', buscar: 'ana  50%' });
      const where = solicitudRepo.findAndCount.mock.calls[0][0].where;
      expect(where.contactado).toBe(false);
      const id = where.id as FindOperator<string>;
      expect(id.type).toBe('raw');
      expect(id.objectLiteralParameters).toEqual({ termino0: '%ana%', termino1: '%50\\%%' });
      const sql = id.getSql!('"S"."id"');
      expect(sql).toContain('"S"."id" IN (SELECT s.id FROM solicitud s WHERE');
      expect(sql).toContain(':termino0 AND concat_ws');
    });

    it('sin buscar no agrega condición', async () => {
      await service.listarSolicitudes({ pagina: 1, limite: 20, filtro: 'todas', buscar: undefined });
      expect(solicitudRepo.findAndCount.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('origen', () => {
    const conSala = { id: 'm1', proyecto: { salaDireccion: '1 Sur 100' } };
    const enDias = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();

    it('la web queda WEB, pendiente y con la visita por confirmar', async () => {
      modeloRepo.findOne.mockResolvedValue(conSala);
      const s = await service.crearSolicitud({ ...dto, visitaPreferida: enDias(2) });
      expect(s).toMatchObject({ origen: 'WEB', contactado: false, visitaEstado: 'POR_CONFIRMAR' });
    });

    it('desde el panel queda contactada, con su origen y la visita confirmada', async () => {
      modeloRepo.findOne.mockResolvedValue(conSala);
      const { aceptaPrivacidad: _, ...datos } = dto;
      const s = await service.crearDesdePanel({ ...datos, origen: 'TELEFONO' as never, clienteInformado: true, visitaPreferida: enDias(2) });
      expect(s).toMatchObject({ origen: 'TELEFONO', contactado: true, visitaEstado: 'CONFIRMADA' });
      expect(s.consentimientoEn).toBeInstanceOf(Date);
    });

    it('sin visita, el estado de la visita es null', async () => {
      modeloRepo.findOne.mockResolvedValue(conSala);
      expect((await service.crearSolicitud(dto)).visitaEstado).toBeNull();
    });
  });

  describe('notas', () => {
    it('guarda el texto con la solicitud y el autor', async () => {
      solicitudRepo.exists.mockResolvedValue(true);
      await service.agregarNota('s1', 'Llamé, no contestó', 'u1');
      expect(notaRepo.save).toHaveBeenCalledWith({ texto: 'Llamé, no contestó', solicitud: { id: 's1' }, usuario: { id: 'u1' } });
    });

    it('404 si la solicitud no existe', async () => {
      solicitudRepo.exists.mockResolvedValue(false);
      await expect(service.agregarNota('s1', 'x', 'u1')).rejects.toBeInstanceOf(NotFoundException);
      expect(notaRepo.save).not.toHaveBeenCalled();
    });

    it('el detalle trae notas y cotizaciones sin datos sensibles del autor', async () => {
      solicitudRepo.findOne.mockResolvedValue({ id: 's1' });
      notaRepo.find.mockResolvedValue([{ id: 'n1' }]);
      cotizacionRepo.find.mockResolvedValue([{ id: 'c1' }]);
      const s = await service.obtenerSolicitud('s1');
      expect(s).toMatchObject({ id: 's1', notas: [{ id: 'n1' }], cotizaciones: [{ id: 'c1' }] });
      for (const repo of [notaRepo, cotizacionRepo]) {
        expect(repo.find.mock.calls[0][0].select.usuario).toEqual({ id: true, nombre: true });
      }
    });
  });

  describe('visita', () => {
    const enHoras = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);
    const conVisita = (visita: Date | null, estado: string | null = 'POR_CONFIRMAR') => ({
      id: 's1', contactado: false, visitaPreferida: visita, visitaEstado: estado,
      modeloCasa: { proyecto: { salaDireccion: '1 Sur 100' } },
    });

    it('reagendar cambia la fecha, la deja confirmada y anota la fecha anterior', async () => {
      solicitudRepo.findOne.mockResolvedValue(conVisita(new Date('2026-12-01T13:00:00Z')));
      const nueva = enHoras(48);
      const s = await service.actualizarVisita('s1', { fecha: nueva.toISOString() }, 'u1');
      expect(s).toMatchObject({ visitaPreferida: nueva, visitaEstado: 'CONFIRMADA', contactado: true });
      const nota = manager.create.mock.calls[0][1];
      expect(nota.texto).toMatch(/^Visita reagendada: del 01-12-2026,? 10:00 al /);
      expect(nota).toMatchObject({ solicitud: { id: 's1' }, usuario: { id: 'u1' } });
    });

    it('agendar cuando no había visita deja una nota "Visita agendada"', async () => {
      solicitudRepo.findOne.mockResolvedValue(conVisita(null, null));
      await service.actualizarVisita('s1', { fecha: enHoras(24).toISOString() }, 'u1');
      expect(manager.create.mock.calls[0][1].texto).toMatch(/^Visita agendada para el /);
    });

    it('confirmar sin fecha no deja nota', async () => {
      solicitudRepo.findOne.mockResolvedValue(conVisita(enHoras(24)));
      const s = await service.actualizarVisita('s1', { estado: 'CONFIRMADA' as never }, 'u1');
      expect(s.visitaEstado).toBe('CONFIRMADA');
      expect(manager.create).not.toHaveBeenCalled();
    });

    it('la asistencia solo se marca cuando la hora ya pasó', async () => {
      solicitudRepo.findOne.mockResolvedValue(conVisita(enHoras(2)));
      await expect(service.actualizarVisita('s1', { estado: 'ASISTIO' as never }, 'u1')).rejects.toThrow('después de la hora');
      solicitudRepo.findOne.mockResolvedValue(conVisita(enHoras(-2)));
      expect((await service.actualizarVisita('s1', { estado: 'NO_ASISTIO' as never }, 'u1')).visitaEstado).toBe('NO_ASISTIO');
    });

    it('400 sin fecha ni estado, o con estado y sin visita', async () => {
      await expect(service.actualizarVisita('s1', {}, 'u1')).rejects.toBeInstanceOf(BadRequestException);
      solicitudRepo.findOne.mockResolvedValue(conVisita(null, null));
      await expect(service.actualizarVisita('s1', { estado: 'CONFIRMADA' as never }, 'u1')).rejects.toThrow('no tiene una visita');
      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  describe('cotizaciones', () => {
    it('congela modelo y precio del servidor con las condiciones elegidas', async () => {
      solicitudRepo.findOne.mockResolvedValue({
        id: 's1', modeloCasa: { nombreModelo: 'Casa A', precio: '3500.50', moneda: 'UF', tipoOperacion: 'VENTA' },
      });
      await service.emitirCotizacion('s1', { pie: 20, tasa: 4.5, plazo: 25, validez: 15, nota: '  sujeto a stock ', uf: { valor: 39000, fecha: '2026-11-12' } }, 'u1');
      expect(cotizacionRepo.save).toHaveBeenCalledWith({
        datos: {
          nombreModelo: 'Casa A', precio: 3500.5, moneda: 'UF', tipoOperacion: 'VENTA', uf: { valor: 39000, fecha: '2026-11-12' },
          pie: 20, tasa: 4.5, plazo: 25, validez: 15, nota: 'sujeto a stock',
        },
        solicitud: { id: 's1' }, usuario: { id: 'u1' },
      });
    });

    it('sin UF guarda null; 404 si la solicitud no existe', async () => {
      solicitudRepo.findOne.mockResolvedValueOnce({ id: 's1', modeloCasa: { nombreModelo: 'A', precio: 1, moneda: 'CLP', tipoOperacion: 'ARRIENDO' } });
      await service.emitirCotizacion('s1', { pie: 0, tasa: 0, plazo: 1, validez: 1 }, 'u1');
      expect(cotizacionRepo.save.mock.calls[0][0].datos).toMatchObject({ uf: null, nota: '' });
      solicitudRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.emitirCotizacion('s2', { pie: 0, tasa: 0, plazo: 1, validez: 1 }, 'u1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('corregir datos (rectificación)', () => {
    const original = () => ({ id: 's1', nombre: 'Juan', apellido: 'Pérez', correo: 'j@p.cl', celular: '+56911111111' });

    it('guarda solo los campos que cambiaron y deja una nota sin el valor anterior', async () => {
      solicitudRepo.findOne.mockResolvedValue(original());
      const s = await service.corregirDatos('s1', { correo: 'juan@p.cl', celular: '+56922222222', nombre: 'Juan' }, 'u1');
      expect(s).toMatchObject({ nombre: 'Juan', correo: 'juan@p.cl', celular: '+56922222222' });
      const nota = manager.create.mock.calls[0][1];
      expect(nota).toEqual({ texto: 'Se corrigieron los datos de contacto: correo y celular.', solicitud: { id: 's1' }, usuario: { id: 'u1' } });
      expect(nota.texto).not.toContain('j@p.cl');
      expect(nota.texto).not.toContain('+56911111111');
    });

    it('sin cambios reales (o con null) no guarda ni deja nota', async () => {
      solicitudRepo.findOne.mockResolvedValue(original());
      await service.corregirDatos('s1', { nombre: 'Juan', apellido: null as unknown as string }, 'u1');
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('404 si la solicitud no existe', async () => {
      solicitudRepo.findOne.mockResolvedValue(null);
      await expect(service.corregirDatos('s9', { nombre: 'X' }, 'u1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
