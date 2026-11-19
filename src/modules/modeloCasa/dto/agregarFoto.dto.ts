import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { UrlHttps } from "../../s3/s3.archivos";

export class AgregarFotoDto{
    @IsString()
    @IsNotEmpty()
    @UrlHttps()
    urlImagen:string;

    @IsOptional()
    @IsInt()
    @Min(0)
    orden?:number;
}