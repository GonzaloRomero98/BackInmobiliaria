import { IsIn, IsInt, IsNotEmpty, IsPositive, IsString } from "class-validator";
import { CARPETAS } from "../s3.archivos";
import type { CarpetaS3 } from "../s3.archivos";

export class PresginedUrlDto{
    @IsString()
    @IsNotEmpty()
    archivo:string;

    @IsString()
    @IsNotEmpty()
    contentType:string;

    // Tamaño exacto del archivo en bytes: queda firmado en la URL y S3 rechaza otro tamaño
    @IsInt()
    @IsPositive()
    tamano:number;

    @IsIn(CARPETAS)
    carpeta:CarpetaS3;
}
