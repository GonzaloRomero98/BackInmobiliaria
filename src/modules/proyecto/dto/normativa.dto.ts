import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from "class-validator";

export const RIESGOS_NATURALES = [
    'INUNDACION',
    'REMOCION_EN_MASA',
    'TSUNAMI',
    'INCENDIO_FORESTAL',
    'VOLCANICO',
    'FALLA_GEOLOGICA',
] as const;

export class NormativaDto{
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    instrumento:string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    zona:string;

    @IsString()
    @IsNotEmpty()
    usosPermitidos:string;

    @IsOptional()
    @IsNumber({maxDecimalPlaces:2})
    @Min(0)
    @Max(1000)
    alturaMaximaMetros?:number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(200)
    alturaMaximaPisos?:number;

    @IsOptional()
    @IsInt()
    @Min(0)
    densidadMaxima?:number;

    @IsOptional()
    @IsNumber({maxDecimalPlaces:2})
    @Min(0)
    @Max(100)
    coefConstructibilidad?:number;

    @IsOptional()
    @IsNumber({maxDecimalPlaces:2})
    @Min(0)
    @Max(1)
    coefOcupacionSuelo?:number;

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(RIESGOS_NATURALES.length)
    @IsIn(RIESGOS_NATURALES, {each:true})
    riesgos?:string[];

    @IsOptional()
    @IsUrl({protocols:['https', 'http'], require_protocol:true})
    urlOrdenanza?:string;

    @IsDateString({strict:true})
    fechaConsulta:string;

    @IsOptional()
    @IsString()
    @MaxLength(2000)
    observaciones?:string;
}
