import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CrearCaractersiticaDto{
    @IsString()
    @IsNotEmpty()
    @MaxLength(150)
    nombre:string
}