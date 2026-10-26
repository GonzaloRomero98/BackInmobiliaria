import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsuarioService } from '../usuario/usuario.service';
import { RolUsuario } from '../rol/rol.enum';

describe('AuthService', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  let usuarioService: { crearUsuario: jest.Mock; usuarioPorCorreo: jest.Mock };
  let authService: AuthService;

  beforeEach(() => {
    usuarioService = { crearUsuario: jest.fn(), usuarioPorCorreo: jest.fn() };
    authService = new AuthService(usuarioService as unknown as UsuarioService, jwtService);
  });

  it('login correcto devuelve un token con sub, correo y rol', async () => {
    const hash = await bcrypt.hash('secreta123', 4);
    usuarioService.usuarioPorCorreo.mockResolvedValue({
      id: 'u1',
      correo: 'a@a.cl',
      contrasena: hash,
      activo: true,
      rol: { nombre: RolUsuario.ADMIN },
    });

    const res = await authService.loginUsuario({ correo: 'a@a.cl', contrasena: 'secreta123' });

    expect(res.usuario).toEqual({ id: 'u1', correo: 'a@a.cl', rol: 'ADMIN' });
    const payload = jwtService.verify(res.access_token);
    expect(payload).toMatchObject({ sub: 'u1', correo: 'a@a.cl', rol: 'ADMIN' });
    expect(res).not.toHaveProperty('usuario.contrasena');
  });

  it('login con contraseña incorrecta lanza 401', async () => {
    const hash = await bcrypt.hash('secreta123', 4);
    usuarioService.usuarioPorCorreo.mockResolvedValue({
      id: 'u1', correo: 'a@a.cl', contrasena: hash, activo: true, rol: { nombre: 'ADMIN' },
    });

    await expect(
      authService.loginUsuario({ correo: 'a@a.cl', contrasena: 'otra' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login de usuario desactivado lanza 401 aunque la contraseña sea correcta', async () => {
    const hash = await bcrypt.hash('secreta123', 4);
    usuarioService.usuarioPorCorreo.mockResolvedValue({
      id: 'u1', correo: 'a@a.cl', contrasena: hash, activo: false, rol: { nombre: 'ADMIN' },
    });

    await expect(
      authService.loginUsuario({ correo: 'a@a.cl', contrasena: 'secreta123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login con correo inexistente lanza 401', async () => {
    usuarioService.usuarioPorCorreo.mockResolvedValue(null);
    await expect(
      authService.loginUsuario({ correo: 'x@x.cl', contrasena: 'algo' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('registrar crea el usuario y devuelve su token', async () => {
    usuarioService.crearUsuario.mockResolvedValue({
      id: 'u2', correo: 'b@b.cl', rol: { nombre: 'SECRETARIO' },
    });

    const res = await authService.registrarUsuario({
      correo: 'b@b.cl', contrasena: '12345678', nombre: 'B', rol: RolUsuario.SECRETARIO,
    });

    expect(res.usuario).toEqual({ id: 'u2', correo: 'b@b.cl', rol: 'SECRETARIO' });
    expect(jwtService.verify(res.access_token).sub).toBe('u2');
  });
});
