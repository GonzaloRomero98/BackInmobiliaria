import {IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min} from 'class-validator'
import { EstadoPropiedad, TipoPropiedad } from './propiedad.entity';

export class CrearPropiedadDto{
    @IsString()
    @IsNotEmpty()
    titulo:string;

    @IsString()
    @IsNotEmpty()
    descripcion: string

    @IsEnum(TipoPropiedad)
    tipoPropiedad: TipoPropiedad

    @IsEnum(EstadoPropiedad)
    estadoPropiedad: EstadoPropiedad

    @IsNumber()
    @Min(0)
    precio: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    gastosComunes?: number;

    @IsString()
    @IsNotEmpty()
    comuna:string;

    @IsString()
    @IsNotEmpty()
    ciudad:string;

    @IsString()
    @IsNotEmpty()
    direccion:string;

    @IsNumber()
    @Min(1)
    banos:number;

    @IsNumber()
    @Min(1)
    dormitorios:number;

    @IsNumber()
    @Min(0)
    estacionamientos?:number;

    @IsBoolean()
    @IsOptional()
    mascotas?: boolean;

    @IsNumber()
    @Min(0)
    totalMetrosCuadrados:number;

    @IsNumber()
    @Min(0)
    metrosCuadradosconstruidos:number;

    @IsNumber()
    anoConstruccion?: number;

    @IsNumber()
    @Min(1)
    piso:number;

    @IsArray()
    @IsString({each:true})
    @IsOptional()
    comodidades?: string[];

    @IsString()
    @IsNotEmpty()
    modelo3dUrl: string;

    @IsString()
    @IsNotEmpty()
    protadaimgUrl:string


}