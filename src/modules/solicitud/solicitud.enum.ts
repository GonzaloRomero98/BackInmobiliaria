// De dónde llegó el cliente: la web, o la secretaria la registró desde el panel
export enum OrigenSolicitud{
    WEB = 'WEB',
    SALA_VENTAS = 'SALA_VENTAS',
    TELEFONO = 'TELEFONO',
    WHATSAPP = 'WHATSAPP',
}

export const ETIQUETA_ORIGEN: Record<OrigenSolicitud, string> = {
    WEB: 'Web', SALA_VENTAS: 'Sala de ventas', TELEFONO: 'Teléfono', WHATSAPP: 'WhatsApp',
};

// null en la solicitud = sin visita. Asistió / No asistió solo cuando la fecha ya pasó.
export enum EstadoVisita{
    POR_CONFIRMAR = 'POR_CONFIRMAR',
    CONFIRMADA = 'CONFIRMADA',
    ASISTIO = 'ASISTIO',
    NO_ASISTIO = 'NO_ASISTIO',
}

export const ETIQUETA_VISITA: Record<EstadoVisita, string> = {
    POR_CONFIRMAR: 'Por confirmar', CONFIRMADA: 'Confirmada', ASISTIO: 'Asistió', NO_ASISTIO: 'No asistió',
};
