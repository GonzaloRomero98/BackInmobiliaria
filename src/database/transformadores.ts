import { ValueTransformer } from "typeorm";

// Postgres devuelve las columnas decimal como texto ("3500.0000"). Esto las convierte a número.
export const decimalANumero: ValueTransformer = {
    to: (valor?: number | null) => valor,
    from: (valor?: string | null) => (valor === null || valor === undefined ? valor : Number(valor)),
};
