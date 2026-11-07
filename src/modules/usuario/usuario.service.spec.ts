import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UsuarioService } from './usuario.service';
import { Usuario } from './entities/usuario.entity';
import { RolService } from '../rol/rol.service';
import { RolUsuario } from '../rol/rol.enum';
import { S3Service } from '../s3/s3.service';

describe('UsuarioService', () => {
  let repo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let rolService: { ObtenerRolByNombre: jest.Mock };
  let s3Service: { keyDeUrl: jest.Mock; eliminarArchivo: jest.Mock };
  let service: UsuarioService;
  const BUCKET = 'https://bucket.s3.us-east-1.amazonaws.com/';
  const dto = { correo: 'a@a.cl', contrasena: '12345678', nombre: 'Ana', rol: RolUsuario.ADMIN };

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'u1', ...x })),
    };
    rolService = { ObtenerRolByNombre: jest.fn() };
    s3Service = {
      keyDeUrl: jest.fn((url: string) => (url.startsWith(BUCKET) ? url.slice(BUCKET.length) : null)),
      eliminarArchivo: jest.fn().mockResolvedValue(undefined),
    };
    service = new UsuarioService(
      repo as unknown as Repository<Usuario>,
      rolService as unknown as RolService,
      s3Service as unknown as S3Service,
    );
  });

  describe('mi perfil', () => {
    const FOTO_VIEJA = `${BUCKET}perfiles/vieja.jpg`;
    const FOTO_NUEVA = `${BUCKET}perfiles/nueva.jpg`;
    const yo = () => ({ id: 'u1', correo: 'a@a.cl', nombre: 'Ana', contrasena: 'hash', activo: true, fotoUrl: FOTO_VIEJA as string | null });

    beforeEach(() => {
      repo.findOne.mockImplementation(async ({ where }) => (where.id === 'u1' ? yo() : null));
    });

    it('miPerfil devuelve los datos sin la contraseña; inexistente -> 404', async () => {
      const perfil = await service.miPerfil('u1');
      expect(perfil).toMatchObject({ id: 'u1', nombre: 'Ana', fotoUrl: FOTO_VIEJA });
      expect(perfil).not.toHaveProperty('contrasena');
      await expect(service.miPerfil('u9')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cambia el nombre sin tocar la foto', async () => {
      const r = await service.actualizarPerfil('u1', { nombre: 'Ana María' });
      expect(r).toMatchObject({ nombre: 'Ana María', fotoUrl: FOTO_VIEJA });
      expect(r).not.toHaveProperty('contrasena');
      expect(s3Service.eliminarArchivo).not.toHaveBeenCalled();
    });

    it('cambia la foto y borra la anterior de S3 después de guardar', async () => {
      const r = await service.actualizarPerfil('u1', { fotoUrl: FOTO_NUEVA });
      expect(r.fotoUrl).toBe(FOTO_NUEVA);
      expect(s3Service.eliminarArchivo).toHaveBeenCalledWith('perfiles/vieja.jpg');
      expect(repo.save.mock.invocationCallOrder[0]).toBeLessThan(s3Service.eliminarArchivo.mock.invocationCallOrder[0]);
    });

    it('fotoUrl null quita la foto y la borra de S3', async () => {
      const r = await service.actualizarPerfil('u1', { fotoUrl: null });
      expect(r.fotoUrl).toBeNull();
      expect(s3Service.eliminarArchivo).toHaveBeenCalledWith('perfiles/vieja.jpg');
    });

    it('rechaza una URL que no sea de la carpeta perfiles del bucket', async () => {
      await expect(service.actualizarPerfil('u1', { fotoUrl: 'https://evil.com/x.jpg' })).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rechaza la foto de otro usuario (al cambiarla después se la borraría)', async () => {
      repo.findOne.mockImplementation(async ({ where }) => (where.id === 'u1' ? yo() : { id: 'u2' }));
      await expect(service.actualizarPerfil('u1', { fotoUrl: FOTO_NUEVA })).rejects.toBeInstanceOf(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('si S3 falla al borrar la foto anterior, el perfil igual queda guardado', async () => {
      s3Service.eliminarArchivo.mockRejectedValue(new Error('S3 caído'));
      await expect(service.actualizarPerfil('u1', { fotoUrl: FOTO_NUEVA })).resolves.toMatchObject({ fotoUrl: FOTO_NUEVA });
    });
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

    it('cambiar o restablecer la contraseña registra la fecha (invalida los tokens anteriores) y no la expone', async () => {
      repo.findOne.mockResolvedValue(await guardado());
      const r = await service.actualizarUsuario('u2', { contrasena: 'Nueva123456' }, 'u1');
      expect(repo.save.mock.calls[0][0].contrasenaCambiadaEn).toBeInstanceOf(Date);
      expect(r).not.toHaveProperty('contrasenaCambiadaEn');

      repo.findOne.mockResolvedValue(await guardado());
      await service.cambiarContrasena('u2', { actual: 'Actual12345', nueva: 'Otra1234567' });
      expect(repo.save.mock.calls[1][0].contrasenaCambiadaEn).toBeInstanceOf(Date);
    });

    it('desactivar sin tocar la contraseña no registra cambio de contraseña', async () => {
      repo.findOne.mockResolvedValue(await guardado());
      await service.actualizarUsuario('u2', { activo: false }, 'u1');
      expect(repo.save.mock.calls[0][0].contrasenaCambiadaEn).toBeUndefined();
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
