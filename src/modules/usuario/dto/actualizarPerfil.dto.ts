import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

// El correo no se puede cambiar porque identifica la cuenta en el login y en la auditoría.
export class ActualizarPerfilDto{
    // ValidateIf en vez de IsOptional para que no pase un null, que la columna no admite.
    @ValidateIf((o) => o.nombre !== undefined)
    @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    nombre?:string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    fotoUrl?:string | null;
}
