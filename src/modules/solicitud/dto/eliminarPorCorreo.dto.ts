import { Transform } from "class-transformer";
import { IsEmail } from "class-validator";

// Derecho de supresión: DELETE /solicitudes?correo=...
export class EliminarPorCorreoDto{
    @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
    @IsEmail({}, {message:'Debe indicar un correo válido'})
    correo: string;
}
