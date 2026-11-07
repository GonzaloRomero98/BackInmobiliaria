import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

// Lo que cada usuario puede cambiar de sí mismo. El correo no: identifica la cuenta en el login y en la auditoría.
export class ActualizarPerfilDto{
    // ValidateIf en vez de IsOptional: así un null no se cuela (la columna no admite null)
    @ValidateIf((o) => o.nombre !== undefined)
    @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    nombre?:string;

    // null quita la foto; el servicio verifica que sea de la carpeta `perfiles` del bucket
    @IsOptional()
    @IsString()
    @MaxLength(500)
    fotoUrl?:string | null;
}
