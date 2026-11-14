import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReservaService } from './reserva.service';
import { Reserva } from './entities/reserva.entity';
import { Solicitud } from '../solicitud/entities/solicitud.entity';
import { ModeloCasa } from '../modeloCasa/entities/modeloCasa.entity';
import { EstadoReserva } from './reserva.enum';

describe('ReservaService', () => {
  const ID_SOLICITUD = '11111111-1111-4111-8111-111111111111';
  let manager: { findOne: jest.Mock; exists: jest.Mock; save: jest.Mock; update: jest.Mock };
  let service: ReservaService;
  let modelo: { id: string; unidades: number; unidadesReservadas: number; unidadesVendidas: number };

  function conModelo(unidades: number, reservadas: number, vendidas: number) {
    modelo = { id: 'm1', unidades, unidadesReservadas: reservadas, unidadesVendidas: vendidas };
  }

  beforeEach(() => {
    conModelo(3, 0, 0);
    manager = {
      findOne: jest.fn(async (entidad: unknown) => {
        if (entidad === Solicitud) return { id: ID_SOLICITUD, modeloCasa: { id: 'm1' } };
        if (entidad === ModeloCasa) return modelo;
        return null;
      }),
      exists: jest.fn().mockResolvedValue(false),
      save: jest.fn(async (_entidad: unknown, datos: object) => ({ id: 'r1', ...datos })),
      update: jest.fn(),
    };
    const dataSource = { transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)) };
    service = new ReservaService(dataSource as unknown as DataSource);
  });

  const dto = { id_solicitud: ID_SOLICITUD, rut: '12345678-5' };

  describe('crear', () => {
    it('con cupo guarda la reserva y suma 1 a reservadas', async () => {
      const reserva = await service.crear(dto);
      expect(reserva).toMatchObject({ rut: '12345678-5', estado: EstadoReserva.RESERVADA, solicitud: { id: ID_SOLICITUD } });
      expect(manager.update).toHaveBeenCalledWith(ModeloCasa, 'm1', { unidadesReservadas: 1, estado: 'DISPONIBLE' });
    });

    it('el último cupo deja el modelo RESERVADO', async () => {
      conModelo(3, 2, 0);
      await service.crear(dto);
      expect(manager.update).toHaveBeenCalledWith(ModeloCasa, 'm1', { unidadesReservadas: 3, estado: 'RESERVADO' });
    });

    it('sin cupo lanza ConflictException y no guarda', async () => {
      conModelo(2, 1, 1);
      await expect(service.crear(dto)).rejects.toThrow(new ConflictException('No quedan unidades de este modelo'));
      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('con una reserva activa previa lanza ConflictException', async () => {
      manager.exists.mockResolvedValue(true);
      await expect(service.crear(dto)).rejects.toThrow(new ConflictException('La solicitud ya tiene una reserva activa'));
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('con solicitud inexistente lanza NotFoundException', async () => {
      manager.findOne.mockResolvedValueOnce(null);
      await expect(service.crear(dto)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('revisa la reserva activa después de bloquear el modelo (dos POST simultáneos se serializan)', async () => {
      await service.crear(dto);
      const bloqueo = manager.findOne.mock.calls.findIndex(([entidad]) => entidad === ModeloCasa);
      expect(manager.findOne.mock.invocationCallOrder[bloqueo]).toBeLessThan(manager.exists.mock.invocationCallOrder[0]);
    });

    it('bloquea el modelo sin relaciones eager', async () => {
      await service.crear(dto);
      expect(manager.findOne).toHaveBeenCalledWith(ModeloCasa, expect.objectContaining({
        where: { id: 'm1' }, lock: { mode: 'pessimistic_write' }, loadEagerRelations: false,
      }));
    });

    it.each([[undefined], [''], ['   ']])('lote %p se guarda como null', async (lote) => {
      const reserva = await service.crear({ ...dto, lote });
      expect(reserva.lote).toBeNull();
    });

    it('lote con texto se guarda sin espacios sobrantes', async () => {
      expect((await service.crear({ ...dto, lote: '  Lote 12 ' })).lote).toBe('Lote 12');
    });
  });

  describe('cambiarEstado', () => {
    function conReserva(estado: EstadoReserva) {
      manager.findOne.mockImplementation(async (entidad: unknown) => {
        if (entidad === Reserva) return { id: 'r1', estado, solicitud: { modeloCasa: { id: 'm1' } } };
        if (entidad === ModeloCasa) return modelo;
        return null;
      });
    }

    it('VENDIDA mueve de reservadas a vendidas', async () => {
      conModelo(3, 1, 2);
      conReserva(EstadoReserva.RESERVADA);
      const reserva = await service.cambiarEstado('r1', EstadoReserva.VENDIDA);
      expect(reserva.estado).toBe(EstadoReserva.VENDIDA);
      expect(manager.update).toHaveBeenCalledWith(ModeloCasa, 'm1', { unidadesReservadas: 0, unidadesVendidas: 3, estado: 'VENDIDO' });
    });

    it('ANULADA libera el cupo', async () => {
      conModelo(3, 3, 0);
      conReserva(EstadoReserva.RESERVADA);
      await service.cambiarEstado('r1', EstadoReserva.ANULADA);
      expect(manager.update).toHaveBeenCalledWith(ModeloCasa, 'm1', { unidadesReservadas: 2, unidadesVendidas: 0, estado: 'DISPONIBLE' });
    });

    it('bloquea el modelo sin relaciones eager', async () => {
      conReserva(EstadoReserva.RESERVADA);
      conModelo(3, 1, 0);
      await service.cambiarEstado('r1', EstadoReserva.ANULADA);
      expect(manager.findOne).toHaveBeenCalledWith(ModeloCasa, expect.objectContaining({
        lock: { mode: 'pessimistic_write' }, loadEagerRelations: false,
      }));
    });

    it.each([EstadoReserva.VENDIDA, EstadoReserva.ANULADA])('desde %s lanza BadRequestException', async (actual) => {
      conReserva(actual);
      await expect(service.cambiarEstado('r1', EstadoReserva.ANULADA)).rejects.toThrow(new BadRequestException('Transición no permitida'));
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('relee el estado tras el bloqueo: si otra transacción ya la cerró, no mueve contadores', async () => {
      conModelo(3, 0, 1);
      let lecturas = 0;
      manager.findOne.mockImplementation(async (entidad: unknown) => {
        if (entidad === Reserva) return { id: 'r1', estado: lecturas++ === 0 ? EstadoReserva.RESERVADA : EstadoReserva.VENDIDA, solicitud: { modeloCasa: { id: 'm1' } } };
        if (entidad === ModeloCasa) return modelo;
        return null;
      });
      await expect(service.cambiarEstado('r1', EstadoReserva.ANULADA)).rejects.toThrow(new BadRequestException('Transición no permitida'));
      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('de una reserva inexistente lanza NotFoundException', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.cambiarEstado('r1', EstadoReserva.VENDIDA)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
