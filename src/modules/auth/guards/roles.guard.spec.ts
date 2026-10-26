import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { RolUsuario } from '../../rol/rol.enum';

function contexto(user: unknown): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  afterEach(() => jest.restoreAllMocks());

  it('deja pasar si la ruta no exige roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contexto({ rol: 'SECRETARIO' }))).toBe(true);
  });

  it('deja pasar si el usuario tiene el rol requerido', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RolUsuario.ADMIN]);
    expect(guard.canActivate(contexto({ rol: 'ADMIN' }))).toBe(true);
  });

  it('bloquea si el usuario no tiene el rol requerido', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RolUsuario.ADMIN]);
    expect(guard.canActivate(contexto({ rol: 'SECRETARIO' }))).toBe(false);
  });
});
