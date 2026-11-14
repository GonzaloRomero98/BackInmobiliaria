import { Auditoria } from "./entities/auditoria.entity";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RECURSOS_CON_NOMBRE = ['proyectos', 'modeloCasa', 'usuarios'] as const;
export type RecursoConNombre = typeof RECURSOS_CON_NOMBRE[number];

export function analizarRuta(ruta: string | null): { recurso: string; id: string | null; patron: string } | null {
    if (!ruta?.startsWith('/api/')) return null;
    const segmentos = ruta.slice('/api/'.length).split('/').filter(Boolean);
    if (segmentos.length === 0) return null;
    return {
        recurso: segmentos[0],
        id: segmentos[1] && UUID.test(segmentos[1]) ? segmentos[1] : null,
        patron: segmentos.map((s) => UUID.test(s) ? ':id' : s).join('/'),
    };
}

type Texto = (nombre: (articulo: string) => string) => string;

const INDEFINIDO: Record<string, string> = { el: 'un', del: 'de un', al: 'a un' };

const DESCRIPCIONES: Record<string, Texto> = {
    'POST proyectos': () => 'Creó un proyecto',
    'PATCH proyectos/:id': (n) => `Editó ${n('el proyecto')}`,
    'DELETE proyectos/:id': (n) => `Despublicó ${n('el proyecto')}`,
    'PATCH proyectos/:id/publicar': (n) => `Volvió a publicar ${n('el proyecto')}`,
    'DELETE proyectos/:id/definitivo': (n) => `Eliminó definitivamente ${n('el proyecto')}`,
    'POST proyectos/:id/entorno': (n) => `Recalculó el entorno ${n('del proyecto')}`,
    'PUT proyectos/:id/normativa': (n) => `Guardó la normativa ${n('del proyecto')}`,

    'POST modeloCasa': () => 'Creó un modelo',
    'PATCH modeloCasa/:id': (n) => `Editó ${n('el modelo')}`,
    // Esta ruta ya no existe, pero se mantiene para describir los registros antiguos.
    'DELETE modeloCasa/:id': (n) => `Despublicó ${n('el modelo')}`,
    'DELETE modeloCasa/:id/definitivo': (n) => `Eliminó definitivamente ${n('el modelo')}`,
    'POST modeloCasa/:id/duplicar': (n) => `Duplicó ${n('el modelo')}`,
    'POST modeloCasa/:id/fotos': (n) => `Agregó una foto ${n('al modelo')}`,
    'PUT modeloCasa/:id/fotos/orden': (n) => `Reordenó las fotos ${n('del modelo')}`,
    'DELETE modeloCasa/:id/fotos/:id': (n) => `Eliminó una foto ${n('del modelo')}`,
    'POST caracteristicas': () => 'Creó una característica',

    'POST solicitudes': () => 'Envió una solicitud desde el sitio',
    'GET solicitudes': () => 'Consultó la bandeja de solicitudes',
    'GET solicitudes/:id': () => 'Consultó el detalle de una solicitud',
    'PATCH solicitudes/:id/contactado': () => 'Marcó una solicitud como contactada',
    'POST solicitudes/panel': () => 'Registró una solicitud desde el panel',
    'POST solicitudes/:id/notas': () => 'Agregó una nota a una solicitud',
    'PATCH solicitudes/:id/visita': () => 'Actualizó la visita de una solicitud',
    'POST solicitudes/:id/cotizaciones': () => 'Emitió una cotización',
    'PATCH solicitudes/:id': () => 'Corrigió los datos de contacto de una solicitud',
    'DELETE solicitudes': () => 'Eliminó las solicitudes de un titular (derecho de supresión)',
    'DELETE solicitudes/:id': () => 'Eliminó una solicitud',

    'POST reservas': () => 'Registró una reserva',
    'PATCH reservas/:id/estado': () => 'Cambió el estado de una reserva',

    'POST auth/logout': () => 'Cerró sesión',

    'POST usuarios': () => 'Creó un usuario',
    'PATCH usuarios/me': () => 'Editó su perfil',
    'PATCH usuarios/me/contrasena': () => 'Cambió su contraseña',
    'PATCH usuarios/:id': (n) => `Editó la cuenta ${n('del usuario')}`,

    'POST s3/presigned-url': () => 'Pidió autorización para subir un archivo',
    'GET metricas': () => 'Consultó el panel de inicio',
    'GET metricas/seguimiento': () => 'Consultó el panel de seguimiento',
};

function describirLogin(estado: number | null, exito: boolean): string {
    if (exito) return 'Inició sesión';
    if (estado === 429) return 'Inicio de sesión bloqueado por demasiados intentos';
    if (estado === 400) return 'Intento de inicio de sesión con datos inválidos';
    return 'Inicio de sesión fallido';
}

type RegistroDescribible = Pick<Auditoria, 'accion' | 'metodo' | 'ruta' | 'estado' | 'exito' | 'detalle'>;

// Texto legible de un registro. Devuelve null si la acción no está en la tabla, y la vista muestra la acción técnica.
export function describirAccion(r: RegistroDescribible, nombres: ReadonlyMap<string, string>): string | null {
    if (r.accion === 'EXPORTAR_SOLICITUDES') return `Exportó las solicitudes a Excel (${r.detalle?.cantidad ?? '?'})`;
    if (r.accion === 'RETENCION_SOLICITUDES') {
        return `Borrado automático por retención: ${r.detalle?.eliminadas ?? '?'} solicitudes con más de ${r.detalle?.dias ?? '?'} días`;
    }
    if (r.accion === 'RETENCION_AUDITORIA') {
        return `Borrado automático por retención: ${r.detalle?.eliminados ?? '?'} registros de auditoría con más de 2 años`;
    }
    const ruta = analizarRuta(r.ruta);
    if (!ruta || !r.metodo) return null;
    if (r.metodo === 'POST' && ruta.patron === 'auth/login') return describirLogin(r.estado, r.exito);

    const texto = DESCRIPCIONES[`${r.metodo} ${ruta.patron}`];
    if (!texto) return null;
    // Si el recurso se eliminó, su nombre quedó guardado en el detalle del registro.
    const nombre = (ruta.id ? nombres.get(ruta.id) : undefined) ?? (typeof r.detalle?.nombre === 'string' ? r.detalle.nombre : undefined);
    return texto((articulo) => nombre ? `${articulo} «${nombre}»` : articulo.replace(/^(el|del|al) /, (_, a: string) => `${INDEFINIDO[a]} `));
}
