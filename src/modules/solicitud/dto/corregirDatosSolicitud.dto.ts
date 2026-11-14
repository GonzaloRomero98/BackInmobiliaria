import { PartialType, PickType } from "@nestjs/swagger";
import { CrearSolicitudDto } from "./crearSolicitud.dto";

// Derecho de rectificación (Ley 21.719): los mismos campos y validaciones del formulario público, todos opcionales.
export class CorregirDatosSolicitudDto extends PartialType(PickType(CrearSolicitudDto, ['nombre', 'apellido', 'correo', 'celular'] as const)){}
