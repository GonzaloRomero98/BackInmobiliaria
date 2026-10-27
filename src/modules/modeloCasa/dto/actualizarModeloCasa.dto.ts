import { PartialType } from "@nestjs/swagger";
import { CrearModeloCasaDto } from "./CrearModeloCasa.dto";

export class ActualizarModeloCasaDto extends PartialType(CrearModeloCasaDto){}
