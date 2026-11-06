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

export enum TipoVivienda{
    CASA='CASA',
    DEPARTAMENTO='DEPARTAMENTO'
}

// Subsidios habitacionales del MINVU a los que el modelo es apto
export const SUBSIDIOS = ['DS1', 'DS19'] as const;
