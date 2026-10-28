import { IsBoolean, IsOptional, IsString } from "class-validator";
import { ContrasenaSegura } from "./crearUsuario.dto";

// El ADMIN puede desactivar/reactivar una cuenta o asignarle una contraseña nueva
export class ActualizarUsuarioDto{
    @IsOptional()
    @IsBoolean()
    activo?:boolean;

    @IsOptional()
    @IsString()
    @ContrasenaSegura()
    contrasena?:string;
}
