import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsUUID, Min } from "class-validator";
import { Moneda, TipoOperacion } from "../modelo-casa.enum";

export const ORDENES_MODELO = ['precio_asc', 'precio_desc', 'superficie_desc', 'recientes'] as const;
export type OrdenModelo = typeof ORDENES_MODELO[number];

const aNumero = () => Type(() => Number);

// Filtros del buscador (query string). Los mínimos de dormitorios/baños son "N o más".
export class FiltrosModeloCasaDto{
    @IsOptional()
    @IsUUID()
    id_proyecto?:string;

    @IsOptional()
    @IsEnum(TipoOperacion)
    tipoOperacion?:TipoOperacion;

    @IsOptional()
    @aNumero()
    @IsInt()
    @IsPositive()
    id_region?:number;

    @IsOptional()
    @aNumero()
    @IsInt()
    @IsPositive()
    id_ciudad?:number;

    // Moneda en que se expresan precioMin/precioMax (solo se comparan modelos en esa moneda)
    @IsOptional()
    @IsEnum(Moneda)
    moneda?:Moneda;

    @IsOptional()
    @aNumero()
    @IsNumber()
    @Min(0)
    precioMin?:number;

    @IsOptional()
    @aNumero()
    @IsNumber()
    @Min(0)
    precioMax?:number;

    @IsOptional()
    @aNumero()
    @IsInt()
    @Min(0)
    dormitorios?:number;

    @IsOptional()
    @aNumero()
    @IsInt()
    @Min(0)
    banos?:number;

    @IsOptional()
    @aNumero()
    @IsNumber()
    @Min(0)
    superficieMin?:number;

    @IsOptional()
    @Transform(({value}) => value === 'true' || value === true ? true : value === 'false' || value === false ? false : value)
    @IsBoolean()
    mascotas?:boolean;

    @IsOptional()
    @IsIn(ORDENES_MODELO)
    orden?:OrdenModelo;
}
