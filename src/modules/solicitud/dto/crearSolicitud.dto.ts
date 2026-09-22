import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CrearSolicitudDto{
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    nombre:string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    apellido:string;

    @IsEmail()
    correo:string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    celular:string;

    @IsOptional()
    @IsString()
    mensaje?:string;
    
    @IsUUID()
    id_modelo_casa:string;

}