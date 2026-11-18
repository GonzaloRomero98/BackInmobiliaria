// Ordenados como Date.getDay(): 0 = domingo.
export const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'] as const;
export type DiaSemana = typeof DIAS_SEMANA[number];
// Cada día tiene sus tramos [abre, cierra] en "HH:MM". Hoy el admin usa uno por día; el arreglo deja espacio para la colación.
// Un día que no aparece está cerrado.
export type HorariosSala = Partial<Record<DiaSemana, [string, string][]>>;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function horariosValidos(valor: unknown): boolean {
    if (valor === null) return true;
    if (typeof valor !== 'object' || Array.isArray(valor)) return false;
    return Object.entries(valor).every(([dia, tramos]) =>
        (DIAS_SEMANA as readonly string[]).includes(dia) && Array.isArray(tramos) && tramos.length > 0 && tramos.length <= 3
        && tramos.every((t) => Array.isArray(t) && t.length === 2 && HORA.test(t[0]) && HORA.test(t[1]) && t[0] < t[1]));
}

const PARTES_CHILE = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const DIA_INGLES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Se mira en hora de Chile, no la del servidor, que corre en UTC.
export function dentroDeHorario(fecha: Date, horarios: HorariosSala): boolean {
    const partes = Object.fromEntries(PARTES_CHILE.formatToParts(fecha).map((p) => [p.type, p.value]));
    const dia = DIAS_SEMANA[DIA_INGLES.indexOf(partes.weekday)];
    const hora = `${partes.hour}:${partes.minute}`;
    return (horarios[dia] ?? []).some(([abre, cierra]) => abre <= hora && hora < cierra);
}
