import { IsEnum, IsISO8601, IsOptional } from "class-validator";
import { EstadoVisita } from "../solicitud.enum";

export class ActualizarVisitaDto{
    @IsOptional()
    @IsISO8601({strict:true})
    fecha?: string;

    @IsOptional()
    @IsEnum(EstadoVisita)
    estado?: EstadoVisita;
}
