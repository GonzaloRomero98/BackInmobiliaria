export enum EstadoReserva{
    RESERVADA='RESERVADA',
    VENDIDA='VENDIDA',
    ANULADA='ANULADA'
}

// Una reserva activa ocupa una unidad y protege la solicitud de los borrados
export const ESTADOS_ACTIVOS = [EstadoReserva.RESERVADA, EstadoReserva.VENDIDA];
