import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, Transporter } from "nodemailer";

@Injectable()
export class CorreoService{
    private readonly logger = new Logger(CorreoService.name);
    private readonly transporte: Transporter | null;
    private readonly remitente: string | undefined;

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
}
