import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { Moneda, SUBSIDIOS, TipoOperacion, TipoVivienda } from "../modelo-casa.enum";

export class CrearModeloCasaDto{
    @IsUUID()
    id_proyecto:string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
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

    @IsOptional()
    @IsEnum(TipoVivienda)
    tipoVivienda?:TipoVivienda;

    // Opcional aquí porque depende del tipo: el servicio la exige en casas
    @IsOptional()
    @IsNumber({maxDecimalPlaces:2})
    @IsPositive()
    superficieTerreno?:number | null;

    @IsNumber({maxDecimalPlaces:4})
    @IsPositive()
    precio:number;

    @IsEnum(Moneda)
    moneda:Moneda;

    // Monto mensual en CLP
    @IsOptional()
    @IsInt()
    @Min(0)
    gastosComunes?:number | null;

    @IsOptional()
    @IsString()
    modelo3dUrl?:string | null;

    @IsOptional()
    @IsString()
    planoUrl?:string | null;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @IsIn(SUBSIDIOS, {each:true})
    subsidios?:string[];

    @IsOptional()
    @IsString()
    @MaxLength(150)
    bono?:string | null;

    @IsString()
    imgPrincipal:string;

    @IsArray()
    @IsInt({each:true})
    caracteristicasID:number[];

    // El estado comercial ya no se envía: se calcula desde las unidades y las reservas
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(9999)
    unidades?:number;

    // false = borrador: no se ve en el catálogo
    @IsOptional()
    @IsBoolean()
    activo?:boolean;
}