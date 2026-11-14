import { timingSafeEqual } from "crypto";
import type { Request } from "express";

// El SSR de Next llama a la API desde la IP del servidor del frontend, así que todos los visitantes compartirían el mismo límite.
// Esas lecturas llevan SSR_CLAVE y no se limitan aquí. El límite por visitante lo aplica Nginx, que sí ve la IP real.
// Solo aplica a GET, para que el login y los formularios mantengan su límite aunque la clave se filtre.
export function esLecturaSsr(req: Request, clave = process.env.SSR_CLAVE): boolean {
    const enviada = req.headers['x-ssr-clave'];
    if (!clave || req.method !== 'GET' || typeof enviada !== 'string') return false;
    const a = Buffer.from(enviada);
    const b = Buffer.from(clave);
    return a.length === b.length && timingSafeEqual(a, b);
}
