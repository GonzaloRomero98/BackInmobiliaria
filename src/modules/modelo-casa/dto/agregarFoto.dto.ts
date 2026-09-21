import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

export class AgregarFotoDto{
    @IsString()
    @IsNotEmpty()
    urlImagen:string;

    @IsOptional()
    @IsInt()
    @Min(0)
    orden?:number;
}