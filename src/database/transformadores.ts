import { ValueTransformer } from "typeorm";

// Postgres devuelve las columnas decimal como string ("3500.0000"); así la API entrega números.
export const decimalANumero: ValueTransformer = {
    to: (valor?: number | null) => valor,
    from: (valor?: string | null) => (valor === null || valor === undefined ? valor : Number(valor)),
};
