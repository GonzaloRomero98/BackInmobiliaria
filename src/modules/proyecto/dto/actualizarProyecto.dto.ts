import { PartialType } from "@nestjs/swagger";
import { CrearProyectoDto } from "./crearProyecto.dto";

export class ActualizarProyectoDto extends PartialType(CrearProyectoDto){}
