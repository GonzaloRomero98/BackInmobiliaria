import { TipoVivienda } from "./modelo-casa.enum";

export interface ExcesoNormativa{
    exceso:number;
    maximoConstruido:number;
}

const redondear = (valor:number) => Math.round(valor * 100) / 100;

// Misma regla que frontend/src/lib/normativa.ts (OGUC): máximo construido = coef. de constructibilidad × terreno.
// Solo se revisan casas. Sin terreno o sin coeficiente mayor que 0 no hay nada que comparar.
// Devuelve null si el modelo no excede el máximo.
export function excesoDeNormativa(
    modelo:{tipoVivienda:string, superficieConstruida:number, superficieTerreno:number | null},
    coefConstructibilidad:number | null | undefined,
):ExcesoNormativa | null{
    const terreno = Number(modelo.superficieTerreno);
    const coef = Number(coefConstructibilidad);
    if(modelo.tipoVivienda !== TipoVivienda.CASA || !(terreno > 0) || !(coef > 0)) return null;

    const maximoConstruido = redondear(coef * terreno);
    const exceso = redondear(Number(modelo.superficieConstruida) - maximoConstruido);
    return exceso > 0 ? {exceso, maximoConstruido} : null;
}
