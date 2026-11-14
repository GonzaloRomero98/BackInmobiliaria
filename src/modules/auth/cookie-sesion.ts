import { CookieOptions, Request, Response } from "express";
import { ExtractJwt } from "passport-jwt";

// El JWT va en una cookie HttpOnly para que un XSS no pueda robar la sesión.
// Sin maxAge se borra al cerrar el navegador. El JWT igual vence a las 8 horas.
export const COOKIE_SESION = 'auth_token';
const OPCIONES: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/' };

export function ponerCookieSesion(res: Response, token: string) {
    res.cookie(COOKIE_SESION, token, OPCIONES);
}

export function borrarCookieSesion(res: Response) {
    res.clearCookie(COOKIE_SESION, OPCIONES);
}

export function tokenDeCookie(req: Request): string | null {
    return req?.headers?.cookie?.match(/(?:^|;\s*)auth_token=([^;]+)/)?.[1] ?? null;
}

// Cookie en el navegador y Bearer para Swagger y los tests. Lo usan la estrategia JWT y el logout.
export const extraerToken = ExtractJwt.fromExtractors([tokenDeCookie, ExtractJwt.fromAuthHeaderAsBearerToken()]);
