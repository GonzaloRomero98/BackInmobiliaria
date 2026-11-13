import { timingSafeEqual } from "crypto";
import type { Request } from "express";

// El SSR de Next llama a la API desde la IP del servidor del frontend: con el límite por IP, todos los visitantes
// compartirían 100/min y uno solo recargando /buscar dejaría el catálogo sin datos. Sus lecturas llevan SSR_CLAVE
// y no se limitan aquí; el límite por visitante real lo pone Nginx (limit_req), que sí ve su IP.
// Solo GET: el login y los formularios mantienen su límite aunque la clave se filtre.
export function esLecturaSsr(req: Request, clave = process.env.SSR_CLAVE): boolean {
    const enviada = req.headers['x-ssr-clave'];
    if (!clave || req.method !== 'GET' || typeof enviada !== 'string') return false;
    const a = Buffer.from(enviada);
    const b = Buffer.from(clave);
    return a.length === b.length && timingSafeEqual(a, b);
}
