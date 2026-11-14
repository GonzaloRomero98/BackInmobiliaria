import { IsBoolean, IsOptional, IsString } from "class-validator";
import { ContrasenaSegura } from "./crearUsuario.dto";

export class ActualizarUsuarioDto{
    @IsOptional()
    @IsBoolean()
    activo?:boolean;

    @IsOptional()
    @IsString()
    @ContrasenaSegura()
    contrasena?:string;
}
