import { Type } from "class-transformer";
import { IsInt, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";

class ValorUfDto{
    @IsNumber()
    @IsPositive()
    valor: number;

    @IsISO8601()
    fecha: string;
}

// Solo las condiciones que elige la secretaria. El precio y el modelo los pone el servidor.
export class CrearCotizacionDto{
    @IsNumber()
    @Min(0)
    @Max(100)
    pie: number;

    @IsNumber()
    @Min(0)
    @Max(20)
    tasa: number;

    @IsInt()
    @Min(1)
    @Max(40)
    plazo: number;

    @IsInt()
    @Min(1)
    @Max(90)
    validez: number;

    @IsOptional()
    @IsString()
    @MaxLength(300)
    nota?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => ValorUfDto)
    uf?: ValorUfDto | null;
}
