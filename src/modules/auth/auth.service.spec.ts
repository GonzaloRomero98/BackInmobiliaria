import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService, BLOQUEO_MS, MAX_INTENTOS_FALLIDOS } from './auth.service';
import { UsuarioService } from '../usuario/usuario.service';
import { RolUsuario } from '../rol/rol.enum';
import { Repository } from 'typeorm';
import { SesionCerrada } from './entities/sesionCerrada.entity';

describe('AuthService', () => {
  const jwtService = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '8h' } });
  let usuarioService: { usuarioPorCorreo: jest.Mock };
  let authService: AuthService;
  let sesionesCerradas: { save: jest.Mock; delete: jest.Mock };

  beforeEach(() => {
    usuarioService = { usuarioPorCorreo: jest.fn() };
    sesionesCerradas = { save: jest.fn(), delete: jest.fn().mockResolvedValue({ affected: 2 }) };
    authService = new AuthService(usuarioService as unknown as UsuarioService, jwtService, sesionesCerradas as unknown as Repository<SesionCerrada>);
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
    const fallar = (correo = 'a@a.cl', ip = '1.1.1.1') =>
      expect(authService.loginUsuario({ correo, contrasena: 'mala' }, ip)).rejects.toBeInstanceOf(UnauthorizedException);
    const entrar = (correo = 'a@a.cl', ip = '1.1.1.1') => authService.loginUsuario({ correo, contrasena: 'secreta123' }, ip);

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

    it('el bloqueo es por correo e IP: desde otra IP la cuenta sigue entrando', async () => {
      for (let i = 0; i < MAX_INTENTOS_FALLIDOS; i++) await fallar('a@a.cl', '6.6.6.6');
      await expect(entrar('a@a.cl', '6.6.6.6')).rejects.toMatchObject({ status: 429 });
      await expect(entrar('a@a.cl', '1.1.1.1')).resolves.toHaveProperty('access_token');
    });

    it('también cuenta correos inexistentes (no revela qué cuentas existen)', async () => {
      usuarioService.usuarioPorCorreo.mockResolvedValue(null);
      for (let i = 0; i < MAX_INTENTOS_FALLIDOS; i++) await fallar('nadie@x.cl');
      await expect(entrar('nadie@x.cl')).rejects.toMatchObject({ status: 429 });
    });
  });


  describe('cerrar sesión', () => {
    it('cada token lleva un jti distinto', async () => {
      const a = jwtService.decode(authService.emitirToken({ id: 'u1', correo: 'a@a.cl', rol: 'ADMIN' }).access_token);
      const b = jwtService.decode(authService.emitirToken({ id: 'u1', correo: 'a@a.cl', rol: 'ADMIN' }).access_token);
      expect(a.jti).toMatch(/^[0-9a-f-]{36}$/);
      expect(a.jti).not.toBe(b.jti);
    });

    it('anota el jti del token con su fecha de vencimiento', async () => {
      const token = authService.emitirToken({ id: 'u1', correo: 'a@a.cl', rol: 'ADMIN' }).access_token;
      const { jti, exp } = jwtService.decode(token);
      await authService.cerrarSesion(token);
      expect(sesionesCerradas.save).toHaveBeenCalledWith({ jti, venceEn: new Date(exp * 1000) });
    });

    it('sin token, con un token inválido o sin jti no anota nada', async () => {
      await authService.cerrarSesion(null);
      await authService.cerrarSesion('no-es-un-token');
      await authService.cerrarSesion(new JwtService({ secret: 'otra' }).sign({ sub: 'u1', jti: 'x' }));
      await authService.cerrarSesion(jwtService.sign({ sub: 'u1' }));
      expect(sesionesCerradas.save).not.toHaveBeenCalled();
    });

    it('la limpieza borra solo las sesiones ya vencidas', async () => {
      await expect(authService.limpiarSesionesCerradas()).resolves.toBe(2);
      const { venceEn } = sesionesCerradas.delete.mock.calls[0][0];
      expect(venceEn).toMatchObject({ _type: 'lessThan' });
      expect(Math.abs(venceEn._value.getTime() - Date.now())).toBeLessThan(5_000);
    });
  });
});
