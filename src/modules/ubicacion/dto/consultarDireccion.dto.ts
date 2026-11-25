import { Type } from "class-transformer";
import { IsNumber, Max, Min } from "class-validator";

export class ConsultarDireccionDto{
    @Type(() => Number)
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitud:number;

    @Type(() => Number)
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitud:number;
}
