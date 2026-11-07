import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService, BLOQUEO_MS, MAX_INTENTOS_FALLIDOS } from './auth.service';
import { UsuarioService } from '../usuario/usuario.service';
import { RolUsuario } from '../rol/rol.enum';

describe('AuthService', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  let usuarioService: { usuarioPorCorreo: jest.Mock };
  let authService: AuthService;

  beforeEach(() => {
    usuarioService = { usuarioPorCorreo: jest.fn() };
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

  describe('bloqueo por cuenta', () => {
    let ahora: number;
    const fallar = (correo = 'a@a.cl') =>
      expect(authService.loginUsuario({ correo, contrasena: 'mala' })).rejects.toBeInstanceOf(UnauthorizedException);
    const entrar = (correo = 'a@a.cl') => authService.loginUsuario({ correo, contrasena: 'secreta123' });

    beforeEach(async () => {
      ahora = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => ahora);
      const hash = await bcrypt.hash('secreta123', 4);
      usuarioService.usuarioPorCorreo.mockResolvedValue({
        id: 'u1', correo: 'a@a.cl', contrasena: hash, activo: true, rol: { nombre: 'ADMIN' },
      });
    });
    afterEach(() => jest.restoreAllMocks());

    it('tras 5 fallos bloquea la cuenta (429) aunque la contraseña sea correcta', async () => {
      for (let i = 0; i < MAX_INTENTOS_FALLIDOS; i++) await fallar();
      await expect(entrar()).rejects.toMatchObject({ status: 429 });
    });

    it('el bloqueo no distingue mayúsculas en el correo', async () => {
      for (let i = 0; i < MAX_INTENTOS_FALLIDOS; i++) await fallar('A@A.cl');
      await expect(entrar('a@a.cl')).rejects.toMatchObject({ status: 429 });
    });

    it('el bloqueo vence 15 minutos después del último fallo', async () => {
      for (let i = 0; i < MAX_INTENTOS_FALLIDOS; i++) await fallar();
      ahora += BLOQUEO_MS - 1;
      await expect(entrar()).rejects.toMatchObject({ status: 429 });
      ahora += 1;
      await expect(entrar()).resolves.toHaveProperty('access_token');
    });

    it('un login correcto reinicia el contador', async () => {
      for (let i = 0; i < MAX_INTENTOS_FALLIDOS - 1; i++) await fallar();
      await entrar();
      for (let i = 0; i < MAX_INTENTOS_FALLIDOS - 1; i++) await fallar();
      await expect(entrar()).resolves.toHaveProperty('access_token');
    });

    it('también cuenta correos inexistentes (no revela qué cuentas existen)', async () => {
      usuarioService.usuarioPorCorreo.mockResolvedValue(null);
      for (let i = 0; i < MAX_INTENTOS_FALLIDOS; i++) await fallar('nadie@x.cl');
      await expect(entrar('nadie@x.cl')).rejects.toMatchObject({ status: 429 });
    });
  });

});
