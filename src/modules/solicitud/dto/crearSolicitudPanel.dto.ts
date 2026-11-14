import { OmitType } from "@nestjs/swagger";
import { Equals, IsIn } from "class-validator";
import { CrearSolicitudDto } from "./crearSolicitud.dto";
import { OrigenSolicitud } from "../solicitud.enum";

export const ORIGENES_PANEL = [OrigenSolicitud.SALA_VENTAS, OrigenSolicitud.TELEFONO, OrigenSolicitud.WHATSAPP] as const;

export class CrearSolicitudPanelDto extends OmitType(CrearSolicitudDto, ['aceptaPrivacidad'] as const){
    @IsIn(ORIGENES_PANEL)
    origen: typeof ORIGENES_PANEL[number];

    // Ley 21.719: la secretaria declara que informó la política de privacidad antes de registrar los datos.
    @Equals(true, {message:'Debes informar al cliente la política de privacidad antes de registrar sus datos'})
    clienteInformado: boolean;
}
