import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { AuditoriaService } from "./auditoria.service";

const METODOS_AUDITADOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Registra toda operación que modifica datos y todo intento rechazado por autenticación/autorización.
// Se evalúa al terminar la respuesta, así incluye los rechazos de guards (401/403) y de rate limit (429).
@Injectable()
export class AuditoriaMiddleware implements NestMiddleware{
    constructor(private readonly auditoriaService: AuditoriaService){}

    use(req: Request, res: Response, next: NextFunction){
        res.on('finish', () => {
            const estado = res.statusCode;
            if(!METODOS_AUDITADOS.has(req.method) && ![401, 403, 429].includes(estado)){
                return;
            }

            const ruta = req.originalUrl.split('?')[0];
            const usuario = req.user as {id?:string, correo?:string, rol?:string} | undefined;
            // En login no hay usuario autenticado: se guarda el correo intentado (nunca la contraseña).
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
            });
        });
        next();
    }
}
