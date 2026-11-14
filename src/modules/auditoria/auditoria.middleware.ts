import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { AuditoriaService } from "./auditoria.service";

const METODOS_AUDITADOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Lecturas de datos personales que se auditan (Ley 21.719, ISO 27001 A.8.15).
// No entran la exportación, que la registra el servicio, ni el resumen, que es solo un número.
const LECTURA_DATOS_PERSONALES = /^\/api\/(solicitudes(\/(?!(exportar|resumen)$)[^/]+)?|metricas(\/seguimiento)?)$/;
// La métrica 3D es anónima. Registrar cada visita llenaría la auditoría, así que solo se guardan sus rechazos.
const RUTA_EVENTOS = '/api/metricas/eventos';

// Registra las operaciones que modifican datos, las lecturas de datos personales y los intentos rechazados.
// Se evalúa al terminar la respuesta para incluir los rechazos 401, 403 y 429.
@Injectable()
export class AuditoriaMiddleware implements NestMiddleware{
    constructor(private readonly auditoriaService: AuditoriaService){}

    use(req: Request, res: Response, next: NextFunction){
        res.on('finish', () => {
            const estado = res.statusCode;
            const ruta = req.originalUrl.split('?')[0];
            const lecturaPersonal = req.method === 'GET' && LECTURA_DATOS_PERSONALES.test(ruta);
            if(!METODOS_AUDITADOS.has(req.method) && ![401, 403, 429].includes(estado) && !lecturaPersonal){
                return;
            }
            if(ruta === RUTA_EVENTOS && estado < 400){
                return;
            }

            const usuario = req.user as {id?:string, correo?:string, rol?:string} | undefined;
            // En el login no hay usuario autenticado, así que se guarda el correo intentado y nunca la contraseña.
            const correoLogin = ruta.endsWith('/auth/login') && typeof req.body?.correo === 'string' ? req.body.correo : null;

            void this.auditoriaService.registrar({
                accion: `${req.method} ${ruta}`.slice(0, 100),
                metodo: req.method,
                ruta: ruta.slice(0, 300),
                estado,
                exito: estado < 400,
                idUsuario: usuario?.id ?? null,
                correo: usuario?.correo ?? correoLogin,
                rol: usuario?.rol ?? null,
                ip: req.ip ?? null,
                detalle: res.locals?.auditoriaDetalle ?? null,
            });
        });
        next();
    }
}
