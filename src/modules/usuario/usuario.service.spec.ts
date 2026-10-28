import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UsuarioService } from './usuario.service';
import { Usuario } from './entities/usuario.entity';
import { RolService } from '../rol/rol.service';
import { RolUsuario } from '../rol/rol.enum';

describe('UsuarioService', () => {
  let repo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let rolService: { ObtenerRolByNombre: jest.Mock };
  let service: UsuarioService;
  const dto = { correo: 'a@a.cl', contrasena: '12345678', nombre: 'Ana', rol: RolUsuario.ADMIN };

  beforeEach(() => {
    repo = {
      find: jest.fn(),
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

  describe('gestión de usuarios', () => {
    const guardado = async (contrasena = 'Actual12345') => ({
      id: 'u2', correo: 's@x.cl', nombre: 'Sec', activo: true, contrasena: await bcrypt.hash(contrasena, 4),
    });

    it('listar no expone el hash de la contraseña', async () => {
      repo.find.mockResolvedValue([await guardado()]);
      const [u] = await service.listarUsuarios();
      expect(u).toMatchObject({ id: 'u2', correo: 's@x.cl' });
      expect(u).not.toHaveProperty('contrasena');
    });

    it('el admin no puede desactivarse a sí mismo', async () => {
      await expect(service.actualizarUsuario('u1', { activo: false }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('desactiva a otro usuario y le asigna contraseña nueva hasheada', async () => {
      repo.findOne.mockResolvedValue(await guardado());
      const r = await service.actualizarUsuario('u2', { activo: false, contrasena: 'Nueva123456' }, 'u1');
      expect(r).toMatchObject({ activo: false });
      expect(r).not.toHaveProperty('contrasena');
      expect(await bcrypt.compare('Nueva123456', repo.save.mock.calls[0][0].contrasena)).toBe(true);
    });

    it('actualizar usuario inexistente -> 404', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.actualizarUsuario('u9', { activo: true }, 'u1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cambiar la propia contraseña exige la actual correcta', async () => {
      repo.findOne.mockResolvedValue(await guardado());
      await expect(service.cambiarContrasena('u2', { actual: 'Otra1234567', nueva: 'Nueva123456' })).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();

      await service.cambiarContrasena('u2', { actual: 'Actual12345', nueva: 'Nueva123456' });
      expect(await bcrypt.compare('Nueva123456', repo.save.mock.calls[0][0].contrasena)).toBe(true);
    });
  });
});
