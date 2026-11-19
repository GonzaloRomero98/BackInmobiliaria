import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, Transporter } from "nodemailer";

// Gmail permite unos 500 correos al día. El formulario público usa como máximo 100, así un abuso
// no agota el cupo y las confirmaciones que envía el panel siguen saliendo.
export const MAX_CORREOS_WEB_POR_DIA = 100;
const diaChile = () => new Date(Date.now()).toLocaleDateString('en-CA', {timeZone:'America/Santiago'});

@Injectable()
export class CorreoService{
    private readonly logger = new Logger(CorreoService.name);
    private readonly transporte: Transporter | null;
    private readonly remitente: string | undefined;
    // Mejora pendiente: el contador está en memoria, se reinicia con la API y no se comparte entre instancias.
    // Con más de una instancia habría que moverlo a la BD.
    private readonly correosWeb = {dia:'', intentos:0};

    constructor(config: ConfigService){
        this.remitente = config.get<string>('SMTP_USUARIO');
        const clave = config.get<string>('SMTP_CLAVE');
        // Sin credenciales la app funciona igual, solo que no envía correos (pruebas y entorno local).
        this.transporte = this.remitente && clave
            ? createTransport({service:'gmail', auth:{user:this.remitente, pass:clave}})
            : null;
    }

    // No lanza errores: un correo que falla no debe romper la solicitud que ya se guardó.
    async enviar(para:string, asunto:string, texto:string):Promise<void>{
        if(!this.transporte) return;
        try{
            await this.transporte.sendMail({from:`Inmocap <${this.remitente}>`, to:para, subject:asunto, text:texto});
        }catch(error){
            // El destinatario no se escribe en el log porque es un dato personal.
            this.logger.warn(`No se pudo enviar el correo "${asunto}": ${(error as Error).message}`);
        }
    }

    // Para correos que dispara el formulario público: el correo de destino no está verificado,
    // así que hay un tope diario (hora de Chile). Pasado el tope no envía nada y tampoco lanza errores.
    async enviarDesdeWeb(para:string, asunto:string, texto:string):Promise<void>{
        if(!this.transporte) return;
        const dia = diaChile();
        if(this.correosWeb.dia !== dia) Object.assign(this.correosWeb, {dia, intentos:0});
        this.correosWeb.intentos++;
        if(this.correosWeb.intentos > MAX_CORREOS_WEB_POR_DIA){
            // Se avisa una sola vez al día para no llenar el log durante un abuso.
            if(this.correosWeb.intentos === MAX_CORREOS_WEB_POR_DIA + 1){
                this.logger.error(`Tope diario de ${MAX_CORREOS_WEB_POR_DIA} correos del formulario web alcanzado; no se envían más hasta mañana`);
            }
            return;
        }
        await this.enviar(para, asunto, texto);
    }
}
