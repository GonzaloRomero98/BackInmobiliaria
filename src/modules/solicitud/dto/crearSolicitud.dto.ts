import { Equals, IsEmail, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

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

    // ISO 8601 con zona horaria (el navegador la envía en UTC); el servicio valida el rango
    @IsOptional()
    @IsISO8601({strict:true})
    visitaPreferida?:string;

    @Equals(true, {message:'Debe aceptar la política de privacidad'})
    aceptaPrivacidad:boolean;

}