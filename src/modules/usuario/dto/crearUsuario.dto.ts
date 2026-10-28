import { IsEmail, IsEnum, IsNotEmpty, IsString, IsStrongPassword } from "class-validator";
import { RolUsuario } from "../../rol/rol.enum";

// Mínimo 10 caracteres con mayúscula, minúscula y número
export const ContrasenaSegura = () => IsStrongPassword(
    {minLength:10, minLowercase:1, minUppercase:1, minNumbers:1, minSymbols:0},
    {message:'La contraseña debe tener al menos 10 caracteres, una mayúscula, una minúscula y un número'}
);

export class CrearUsuarioDto{
    @IsEmail()
    correo: string;

    @IsString()
    @ContrasenaSegura()
    contrasena:string;

    @IsString()
    @IsNotEmpty()
    nombre:string;

    @IsEnum(RolUsuario)
    rol:RolUsuario;
    
}