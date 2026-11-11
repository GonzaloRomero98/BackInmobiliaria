import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export const FILTROS_SOLICITUD = ['pendientes', 'contactados', 'visita', 'todas'] as const;
export type FiltroSolicitud = typeof FILTROS_SOLICITUD[number];

// Query string de la bandeja: GET /solicitudes?pagina=2&limite=20&filtro=pendientes
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
}
