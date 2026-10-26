import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FindOperator, Repository } from 'typeorm';
import { SolicitudService } from './solicitud.service';
import { Solicitud } from './entities/solicitud.entity';
import { ModeloCasa } from '../modeloCasa/entities/modeloCasa.entity';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('SolicitudService', () => {
  let solicitudRepo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock; delete: jest.Mock; createQueryBuilder: jest.Mock };
  let modeloRepo: { findOne: jest.Mock };
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
  });
});
