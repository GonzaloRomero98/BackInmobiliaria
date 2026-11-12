import { IsEnum, IsUUID } from "class-validator";
import { TipoEventoModelo } from "../entities/eventoModelo.entity";

export class RegistrarEventoDto{
    @IsUUID()
    id_modelo_casa:string;

    @IsEnum(TipoEventoModelo)
    tipo:TipoEventoModelo;
}
