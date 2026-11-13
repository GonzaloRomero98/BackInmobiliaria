import { IsEnum, IsISO8601, IsOptional } from "class-validator";
import { EstadoVisita } from "../solicitud.enum";

// fecha = agendar o reagendar (queda una nota automática); estado = confirmar o marcar asistencia
export class ActualizarVisitaDto{
    @IsOptional()
    @IsISO8601({strict:true})
    fecha?: string;

    @IsOptional()
    @IsEnum(EstadoVisita)
    estado?: EstadoVisita;
}
