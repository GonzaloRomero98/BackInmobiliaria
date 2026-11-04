import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class DuplicarModeloCasaDto{
    // Sin espacios al inicio/final, para que "Casa A " no se cuele como un nombre distinto de "Casa A"
    @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    nombreModelo:string;
}
