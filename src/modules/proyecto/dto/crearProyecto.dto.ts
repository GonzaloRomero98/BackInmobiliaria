import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { EtapaProyecto } from "../proyecto.enum";

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

    @IsOptional()
    @IsEnum(EtapaProyecto)
    etapa?:EtapaProyecto | null;

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, {message:'fechaEntrega debe tener formato AAAA-MM-DD'})
    @IsDateString({strict:true})
    fechaEntrega?:string | null;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    salaDireccion?:string | null;

    // Texto libre, p. ej. "Lun a sáb 10:00 a 18:00"
    @IsOptional()
    @IsString()
    @MaxLength(150)
    salaHorario?:string | null;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    salaTelefono?:string | null;

    @IsOptional()
    @IsNumber({maxDecimalPlaces:6})
    @Min(-90)
    @Max(90)
    salaLatitud?:number | null;

    @IsOptional()
    @IsNumber({maxDecimalPlaces:6})
    @Min(-180)
    @Max(180)
    salaLongitud?:number | null;
}
