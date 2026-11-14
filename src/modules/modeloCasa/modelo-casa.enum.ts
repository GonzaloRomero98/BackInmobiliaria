export enum TipoOperacion{
    VENTA = 'VENTA',
    ARRIENDO = 'ARRIENDO'
}

export enum Moneda{
    UF='UF',
    CLP='CLP'
}

export enum EstadoModelo{
    DISPONIBLE='DISPONIBLE',
    RESERVADO='RESERVADO',
    VENDIDO='VENDIDO'
}

// Estado comercial calculado desde los contadores de unidades.
export function calcularEstado(unidades:number, reservadas:number, vendidas:number):EstadoModelo{
    if(unidades - reservadas - vendidas > 0) return EstadoModelo.DISPONIBLE;
    return reservadas > 0 ? EstadoModelo.RESERVADO : EstadoModelo.VENDIDO;
}

export enum TipoVivienda{
    CASA='CASA',
    DEPARTAMENTO='DEPARTAMENTO'
}

export const SUBSIDIOS = ['DS1', 'DS19'] as const;
