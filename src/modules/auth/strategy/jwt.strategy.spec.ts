import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsuarioService } from '../../usuario/usuario.service';

describe('JwtStrategy', () => {
  const usuarioService = { usuarioPorId: jest.fn() };
  const strategy = new JwtStrategy(
    new ConfigService({ JWT_SECRET: 'test-secret' }),
    usuarioService as unknown as UsuarioService,
  );
  const payload = { sub: 'u1', correo: 'viejo@x.cl', rol: 'ADMIN' };

  it('usa los datos actuales de la BD (rol cambiado se aplica de inmediato)', async () => {
    usuarioService.usuarioPorId.mockResolvedValue({
      id: 'u1', correo: 'a@x.cl', activo: true, rol: { nombre: 'SECRETARIO' },
    });
    await expect(strategy.validate(payload)).resolves.toEqual({ id: 'u1', correo: 'a@x.cl', rol: 'SECRETARIO' });
  });

  it('rechaza el token de un usuario desactivado', async () => {
    usuarioService.usuarioPorId.mockResolvedValue({ id: 'u1', activo: false, rol: { nombre: 'ADMIN' } });
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza el token de un usuario eliminado', async () => {
    usuarioService.usuarioPorId.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
