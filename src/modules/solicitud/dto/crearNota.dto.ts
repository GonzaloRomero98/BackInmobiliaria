import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CrearNotaDto{
    @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @IsNotEmpty({message:'La nota no puede estar vacía'})
    @MaxLength(2000)
    texto: string;
}
