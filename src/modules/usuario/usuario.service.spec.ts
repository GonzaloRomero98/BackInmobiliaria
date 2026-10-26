import { BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UsuarioService } from './usuario.service';
import { Usuario } from './entities/usuario.entity';
import { RolService } from '../rol/rol.service';
import { RolUsuario } from '../rol/rol.enum';

describe('UsuarioService', () => {
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let rolService: { ObtenerRolByNombre: jest.Mock };
  let service: UsuarioService;
  const dto = { correo: 'a@a.cl', contrasena: '12345678', nombre: 'Ana', rol: RolUsuario.ADMIN };

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'u1', ...x })),
    };
    rolService = { ObtenerRolByNombre: jest.fn() };
    service = new UsuarioService(
      repo as unknown as Repository<Usuario>,
      rolService as unknown as RolService,
    );
  });

  it('guarda la contraseña hasheada y con la entidad rol', async () => {
    repo.findOne.mockResolvedValue(null);
    rolService.ObtenerRolByNombre.mockResolvedValue({ id: 1, nombre: 'ADMIN' });

    const usuario = await service.crearUsuario(dto);

    expect(usuario.contrasena).not.toBe('12345678');
    expect(await bcrypt.compare('12345678', usuario.contrasena)).toBe(true);
    expect(usuario.rol).toEqual({ id: 1, nombre: 'ADMIN' });
  });

  it('rechaza correos duplicados con 409', async () => {
    repo.findOne.mockResolvedValue({ id: 'existente' });
    await expect(service.crearUsuario(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza si el rol no existe en la BD', async () => {
    repo.findOne.mockResolvedValue(null);
    rolService.ObtenerRolByNombre.mockResolvedValue(null);
    await expect(service.crearUsuario(dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
