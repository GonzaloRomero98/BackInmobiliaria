import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from "class-validator";

export class CrearProyectoDto{
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    nombre:string;

    @IsInt()
    @IsPositive()
    id_ciudad:number;

    @IsOptional()
    @IsString()
    descripcion?:string;

    @IsString()
    imagenPortada:string;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    direccion?:string;

    @IsOptional()
    @IsNumber({maxDecimalPlaces:6})
    @Min(-90)
    @Max(90)
    latitud?:number;

    @IsOptional()
    @IsNumber({maxDecimalPlaces:6})
    @Min(-180)
    @Max(180)
    longitud?:number;
}
