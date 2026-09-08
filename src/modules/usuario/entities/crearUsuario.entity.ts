import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from "class-validator";
import { RolUsuario } from "./usuario.entity";

export class CrearUsuarioDto{
    @IsEmail()
    correo: string;

    @IsString()
    @MinLength(8)
    contrasena:string;

    @IsString()
    @IsNotEmpty()
    nombre:string;

    @IsEnum(RolUsuario)
    rol:RolUsuario
    
}