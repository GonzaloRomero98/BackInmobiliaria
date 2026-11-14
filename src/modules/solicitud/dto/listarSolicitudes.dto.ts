import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export const FILTROS_SOLICITUD = ['pendientes', 'contactados', 'visita', 'todas'] as const;
export type FiltroSolicitud = typeof FILTROS_SOLICITUD[number];

export class ListarSolicitudesDto{
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pagina: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limite: number = 20;

    @IsOptional()
    @IsIn(FILTROS_SOLICITUD)
    filtro: FiltroSolicitud = 'todas';

    @IsOptional()
    @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @MaxLength(100)
    buscar?: string;
}
