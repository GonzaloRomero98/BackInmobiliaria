import { Transform } from "class-transformer";
import { Equals, IsEmail, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";

// Acepta "9 1234 5678", "912345678", "+56 9 1234-5678"... y lo deja como +569XXXXXXXX para wa.me
export function normalizarCelular(valor: string): string {
    const digitos = valor.replace(/\D/g, '');
    if (/^569\d{8}$/.test(digitos)) return '+' + digitos;
    if (/^9\d{8}$/.test(digitos)) return '+56' + digitos;
    return valor.trim();
}

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

    @Transform(({value}) => typeof value === 'string' ? normalizarCelular(value) : value)
    @IsString()
    @Matches(/^\+569\d{8}$/, {message:'El celular debe ser un móvil chileno: +56 9 XXXX XXXX'})
    celular:string;

    @IsOptional()
    @IsString()
    mensaje?:string;
    
    @IsUUID()
    id_modelo_casa:string;

    // ISO 8601 con zona horaria (el navegador la envía en UTC); el servicio valida el rango
    @IsOptional()
    @IsISO8601({strict:true})
    visitaPreferida?:string;

    @Equals(true, {message:'Debe aceptar la política de privacidad'})
    aceptaPrivacidad:boolean;

}