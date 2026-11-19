import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CaracteristicaService } from './caracteristica.service';
import { Caracteristica } from './entities/caracteristica.entity';

describe('CaracteristicaService', () => {
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let service: CaracteristicaService;

  beforeEach(() => {
    repo = { findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: 1, ...x })) };
    service = new CaracteristicaService(repo as unknown as Repository<Caracteristica>);
  });

  it('409 si ya existe con otras mayúsculas; busca sin distinguirlas, igual que el índice único', async () => {
    repo.findOne.mockResolvedValue({ id: 1, nombre: 'piscina' });
    await expect(service.crearCaracteristica({ nombre: 'Piscina' })).rejects.toBeInstanceOf(ConflictException);
    const { nombre } = repo.findOne.mock.calls[0][0].where;
    expect(nombre.getSql('nombre')).toBe('LOWER(nombre) = LOWER(:nombre)');
    expect(nombre.objectLiteralParameters).toEqual({ nombre: 'Piscina' });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('crea la característica si el nombre está libre', async () => {
    repo.findOne.mockResolvedValue(null);
    expect(await service.crearCaracteristica({ nombre: 'Quincho' })).toEqual({ id: 1, nombre: 'Quincho' });
  });
});
