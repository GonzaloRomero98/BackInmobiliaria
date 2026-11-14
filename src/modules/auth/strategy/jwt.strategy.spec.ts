import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsuarioService } from '../../usuario/usuario.service';
import { Repository } from 'typeorm';
import { SesionCerrada } from '../entities/sesionCerrada.entity';

describe('JwtStrategy', () => {
  const usuarioService = { usuarioPorId: jest.fn() };
  const sesionesCerradas = { exists: jest.fn().mockResolvedValue(false) };
  const strategy = new JwtStrategy(new ConfigService({ JWT_SECRET: 'test' }), usuarioService as unknown as UsuarioService,
    sesionesCerradas as unknown as Repository<SesionCerrada>);
  const CAMBIO_SEG = 2_000_000_000;
  const payload = (iat: number) => ({ sub: 'u1', correo: 'a@a.cl', rol: 'ADMIN', iat });
  const usuario = (contrasenaCambiadaEn: Date | null) =>
    ({ id: 'u1', correo: 'a@a.cl', activo: true, rol: { nombre: 'ADMIN' }, contrasenaCambiadaEn });

  it('rechaza un token emitido antes del último cambio de contraseña', async () => {
    usuarioService.usuarioPorId.mockResolvedValue(usuario(new Date(CAMBIO_SEG * 1000 + 500)));
    await expect(strategy.validate(payload(CAMBIO_SEG - 1))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('acepta el token emitido en el mismo segundo del cambio o después (iat no tiene milisegundos)', async () => {
    usuarioService.usuarioPorId.mockResolvedValue(usuario(new Date(CAMBIO_SEG * 1000 + 500)));
    await expect(strategy.validate(payload(CAMBIO_SEG))).resolves.toEqual({ id: 'u1', correo: 'a@a.cl', rol: 'ADMIN' });
  });

  it('sin cambios de contraseña registrados acepta el token', async () => {
    usuarioService.usuarioPorId.mockResolvedValue(usuario(null));
    await expect(strategy.validate(payload(1))).resolves.toMatchObject({ id: 'u1' });
  });

  it('rechaza usuarios desactivados', async () => {
    usuarioService.usuarioPorId.mockResolvedValue({ ...usuario(null), activo: false });
    await expect(strategy.validate(payload(CAMBIO_SEG))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza un token cerrado con logout y acepta otro token del mismo usuario', async () => {
    usuarioService.usuarioPorId.mockResolvedValue(usuario(null));
    sesionesCerradas.exists.mockImplementation(async ({ where }) => where.jti === 'cerrado');
    await expect(strategy.validate({ ...payload(CAMBIO_SEG), jti: 'cerrado' })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(strategy.validate({ ...payload(CAMBIO_SEG), jti: 'otro-equipo' })).resolves.toMatchObject({ id: 'u1' });
    sesionesCerradas.exists.mockResolvedValue(false);
  });

  it('un token sin jti (emitido antes del cambio) no consulta la lista de sesiones cerradas', async () => {
    sesionesCerradas.exists.mockClear();
    usuarioService.usuarioPorId.mockResolvedValue(usuario(null));
    await expect(strategy.validate(payload(CAMBIO_SEG))).resolves.toMatchObject({ id: 'u1' });
    expect(sesionesCerradas.exists).not.toHaveBeenCalled();
  });
});
