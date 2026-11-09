import { IsIn } from "class-validator";
import { EstadoReserva } from "../reserva.enum";

export class CambiarEstadoReservaDto{
    // Una reserva solo se crea RESERVADA; desde ahí pasa a VENDIDA o ANULADA
    @IsIn([EstadoReserva.VENDIDA, EstadoReserva.ANULADA], {message:'El estado debe ser VENDIDA o ANULADA'})
    estado:EstadoReserva.VENDIDA | EstadoReserva.ANULADA;
}
