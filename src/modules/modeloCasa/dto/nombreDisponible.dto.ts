import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

// GET /modeloCasa/admin/nombre-disponible?nombre=...&excluirId=...
export class NombreDisponibleDto{
    @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
    @IsString({message:'Debe indicar un nombre de 1 a 150 caracteres'})
    @IsNotEmpty({message:'Debe indicar un nombre de 1 a 150 caracteres'})
    @MaxLength(150, {message:'Debe indicar un nombre de 1 a 150 caracteres'})
    nombre: string;

    // Al editar, el propio modelo no cuenta como ocupado.
    @IsOptional()
    @IsUUID()
    excluirId?: string;
}
