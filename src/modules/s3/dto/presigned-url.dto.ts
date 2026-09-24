import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class PresginedUrlDto{
    @IsString()
    @IsNotEmpty()
    archivo:string;

    @IsString()
    @IsNotEmpty()
    contentType:string;

    @IsIn(['proyectos', 'modelosImagenes','modelos3D'])
    carpeta:string;
}