import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

export class CrearProyectoDto{
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    nombre:string;

    @IsInt()
    @IsPositive()
    id_ciudad:number;

    @IsString()
    descripcion:string;

    @IsString()
    imagenPortada:string;
}