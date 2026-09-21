import { IsBoolean, IsDecimal, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, Min } from "class-validator";
import { Moneda, TipoOperacion } from "../modelo-casa.enum";

export class CrearModeloCasaDto{
    @IsUUID()
    id_proyecto:string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    nombreModelo:string;

    @IsEnum(TipoOperacion)
    tipoOperacion:TipoOperacion;

    @IsInt()
    @Min(0)
    dormitorios:number;

    @IsInt()
    @Min(1)
    banos:number;

    @IsInt()
    @Min(0)
    estacionamiento:number;

    @IsBoolean()
    @IsNotEmpty()
    mascotas:boolean;

    @IsNumber({maxDecimalPlaces:2})
    @IsPositive()
    superficieConstruida:number;

    @IsNumber({maxDecimalPlaces:2})
    @IsPositive()
    superficieTerreno:number;

    @IsNumber({maxDecimalPlaces:4})
    @IsPositive()
    precio:number;

    @IsEnum(Moneda)
    moneda:Moneda;

    @IsOptional()
    @IsBoolean()
    gastosComunes:boolean;

    @IsString()
    modelo3dUrl:string;

    @IsString()
    imagenPrincipal:string;
}