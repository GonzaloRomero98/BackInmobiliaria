import { analizarRuta, describirAccion } from './auditoria.descripcion';

const ID = '11111111-1111-4111-8111-111111111111';
const FOTO = '22222222-2222-4222-8222-222222222222';
const registro = (metodo: string | null, ruta: string | null, extra: Partial<{ estado: number; exito: boolean; accion: string; detalle: Record<string, unknown> }> = {}) => ({
  accion: extra.accion ?? `${metodo} ${ruta}`, metodo, ruta, estado: extra.estado ?? 200, exito: extra.exito ?? true, detalle: extra.detalle ?? null,
});
const nombres = new Map([[ID, 'Los Robles']]);

describe('analizarRuta', () => {
  it('reemplaza los UUID por :id y separa recurso e id', () => {
    expect(analizarRuta(`/api/modeloCasa/${ID}/fotos/${FOTO}`)).toEqual({ recurso: 'modeloCasa', id: ID, patron: 'modeloCasa/:id/fotos/:id' });
    expect(analizarRuta('/api/usuarios/me/contrasena')).toEqual({ recurso: 'usuarios', id: null, patron: 'usuarios/me/contrasena' });
  });

  it('null si no es una ruta de la API', () => {
    expect(analizarRuta(null)).toBeNull();
    expect(analizarRuta('/otra')).toBeNull();
    expect(analizarRuta('/api/')).toBeNull();
  });
});

describe('describirAccion', () => {
  it.each([
    ['PATCH', `/api/proyectos/${ID}/publicar`, 'Volvió a publicar el proyecto «Los Robles»'],
    ['DELETE', `/api/proyectos/${ID}`, 'Despublicó el proyecto «Los Robles»'],
    ['DELETE', `/api/modeloCasa/${ID}/fotos/${FOTO}`, 'Eliminó una foto del modelo «Los Robles»'],
    ['POST', `/api/modeloCasa/${ID}/fotos`, 'Agregó una foto al modelo «Los Robles»'],
    ['PATCH', '/api/usuarios/me/contrasena', 'Cambió su contraseña'],
    ['DELETE', '/api/solicitudes', 'Eliminó las solicitudes de un titular (derecho de supresión)'],
    ['GET', `/api/solicitudes/${ID}`, 'Consultó el detalle de una solicitud'],
  ])('%s %s', (metodo, ruta, esperado) => {
    expect(describirAccion(registro(metodo, ruta), nombres)).toBe(esperado);
  });

  it('si el recurso ya no se encuentra, usa un artículo indefinido', () => {
    expect(describirAccion(registro('PATCH', `/api/proyectos/${FOTO}`), nombres)).toBe('Editó un proyecto');
    expect(describirAccion(registro('PUT', `/api/proyectos/${FOTO}/normativa`), nombres)).toBe('Guardó la normativa de un proyecto');
    expect(describirAccion(registro('POST', `/api/modeloCasa/${FOTO}/fotos`), nombres)).toBe('Agregó una foto a un modelo');
  });

  it.each([
    [200, true, 'Inició sesión'],
    [401, false, 'Inicio de sesión fallido'],
    [429, false, 'Inicio de sesión bloqueado por demasiados intentos'],
    [400, false, 'Intento de inicio de sesión con datos inválidos'],
  ])('login con estado %i', (estado, exito, esperado) => {
    expect(describirAccion(registro('POST', '/api/auth/login', { estado, exito }), nombres)).toBe(esperado);
  });

  it('acciones internas usan su detalle', () => {
    expect(describirAccion(registro(null, null, { accion: 'EXPORTAR_SOLICITUDES', detalle: { cantidad: 12 } }), nombres))
      .toBe('Exportó las solicitudes a Excel (12)');
    expect(describirAccion(registro(null, null, { accion: 'RETENCION_SOLICITUDES', detalle: { dias: 365, eliminadas: 3 } }), nombres))
      .toBe('Borrado automático por retención: 3 solicitudes con más de 365 días');
  });

  it('null para acciones que no están en la tabla (la vista muestra la técnica)', () => {
    expect(describirAccion(registro('GET', '/api/usuarios', { estado: 403, exito: false }), nombres)).toBeNull();
  });
});
