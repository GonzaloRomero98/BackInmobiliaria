import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { AuditoriaMiddleware } from './auditoria.middleware';
import { AuditoriaService } from './auditoria.service';

describe('AuditoriaMiddleware', () => {
  const auditoria = { registrar: jest.fn() };
  const middleware = new AuditoriaMiddleware(auditoria as unknown as AuditoriaService);

  function ejecutar(req: Partial<Request>, estado: number) {
    const res = Object.assign(new EventEmitter(), { statusCode: estado });
    const next = jest.fn();
    middleware.use({ ip: '1.2.3.4', ...req } as Request, res as unknown as Response, next);
    expect(next).toHaveBeenCalled();
    res.emit('finish');
  }

  beforeEach(() => auditoria.registrar.mockReset());

  it('registra operaciones que modifican datos con el usuario autenticado', () => {
    ejecutar({
      method: 'PATCH', originalUrl: '/api/solicitudes/abc/contactado?x=1',
      user: { id: 'u1', correo: 'a@x.cl', rol: 'SECRETARIO' },
    } as Partial<Request>, 200);

    expect(auditoria.registrar).toHaveBeenCalledWith({
      accion: 'PATCH /api/solicitudes/abc/contactado', metodo: 'PATCH', ruta: '/api/solicitudes/abc/contactado',
      estado: 200, exito: true, idUsuario: 'u1', correo: 'a@x.cl', rol: 'SECRETARIO', ip: '1.2.3.4',
    });
  });

  it('en login guarda el correo intentado pero nunca la contraseña', () => {
    ejecutar({ method: 'POST', originalUrl: '/api/auth/login', body: { correo: 'x@x.cl', contrasena: 'secreta' } }, 401);

    const registro = auditoria.registrar.mock.calls[0][0];
    expect(registro).toMatchObject({ correo: 'x@x.cl', exito: false, estado: 401 });
    expect(JSON.stringify(registro)).not.toContain('secreta');
  });

  it('registra GET rechazados por autorización', () => {
    ejecutar({ method: 'GET', originalUrl: '/api/solicitudes' }, 403);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ estado: 403, exito: false }));
  });

  it('no registra lecturas normales', () => {
    ejecutar({ method: 'GET', originalUrl: '/api/proyectos' }, 200);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });
});
