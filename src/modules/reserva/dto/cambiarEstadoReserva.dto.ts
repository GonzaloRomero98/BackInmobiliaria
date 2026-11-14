import { IsIn } from "class-validator";
import { EstadoReserva } from "../reserva.enum";

export class CambiarEstadoReservaDto{
    @IsIn([EstadoReserva.VENDIDA, EstadoReserva.ANULADA], {message:'El estado debe ser VENDIDA o ANULADA'})
    estado:EstadoReserva.VENDIDA | EstadoReserva.ANULADA;
}
