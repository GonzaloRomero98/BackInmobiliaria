import { IsNotEmpty, IsString } from "class-validator";
import { ContrasenaSegura } from "./crearUsuario.dto";

export class CambiarContrasenaDto{
    @IsString()
    @IsNotEmpty()
    actual:string;

    @IsString()
    @ContrasenaSegura()
    nueva:string;
}
