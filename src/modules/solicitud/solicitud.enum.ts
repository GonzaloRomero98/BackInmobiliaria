export enum OrigenSolicitud{
    WEB = 'WEB',
    SALA_VENTAS = 'SALA_VENTAS',
    TELEFONO = 'TELEFONO',
    WHATSAPP = 'WHATSAPP',
}

export const ETIQUETA_ORIGEN: Record<OrigenSolicitud, string> = {
    WEB: 'Web', SALA_VENTAS: 'Sala de ventas', TELEFONO: 'Teléfono', WHATSAPP: 'WhatsApp',
};

export enum EstadoVisita{
    POR_CONFIRMAR = 'POR_CONFIRMAR',
    CONFIRMADA = 'CONFIRMADA',
    ASISTIO = 'ASISTIO',
    NO_ASISTIO = 'NO_ASISTIO',
}

export const ETIQUETA_VISITA: Record<EstadoVisita, string> = {
    POR_CONFIRMAR: 'Por confirmar', CONFIRMADA: 'Confirmada', ASISTIO: 'Asistió', NO_ASISTIO: 'No asistió',
};
