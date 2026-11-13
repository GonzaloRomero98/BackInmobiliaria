import { OmitType } from "@nestjs/swagger";
import { Equals, IsIn } from "class-validator";
import { CrearSolicitudDto } from "./crearSolicitud.dto";
import { OrigenSolicitud } from "../solicitud.enum";

export const ORIGENES_PANEL = [OrigenSolicitud.SALA_VENTAS, OrigenSolicitud.TELEFONO, OrigenSolicitud.WHATSAPP] as const;

// Cliente que llega a la sala, llama o escribe: lo registra la secretaria con los mismos datos que el formulario web
export class CrearSolicitudPanelDto extends OmitType(CrearSolicitudDto, ['aceptaPrivacidad'] as const){
    @IsIn(ORIGENES_PANEL)
    origen: typeof ORIGENES_PANEL[number];

    // Ley 21.719: la secretaria declara que le informó al cliente la política de privacidad antes de registrar sus datos
    @Equals(true, {message:'Debes informar al cliente la política de privacidad antes de registrar sus datos'})
    clienteInformado: boolean;
}
