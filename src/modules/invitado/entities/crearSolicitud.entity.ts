import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CrearSolicitudDTO{
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @IsEmail()
    correo:string;

    @IsString()
    @IsNotEmpty()
    celular:string;

    @IsString()
    @IsOptional()
    mensaje?:string;

    @IsUUID()
    idPropiedad:string;
}