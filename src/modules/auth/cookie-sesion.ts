import { CookieOptions, Request, Response } from "express";

// El JWT viaja en una cookie HttpOnly: el JavaScript de la página no puede leerla, así un XSS no roba la sesión.
// Sin maxAge (cookie de sesión): se borra al cerrar el navegador; el JWT igual vence a las 8 h.
export const COOKIE_SESION = 'auth_token';
const OPCIONES: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/' };

export function ponerCookieSesion(res: Response, token: string) {
    res.cookie(COOKIE_SESION, token, OPCIONES);
}

export function borrarCookieSesion(res: Response) {
    res.clearCookie(COOKIE_SESION, OPCIONES);
}

// Extractor para passport-jwt (Express no trae cookie-parser; el JWT no tiene caracteres que codificar)
export function tokenDeCookie(req: Request): string | null {
    return req?.headers?.cookie?.match(/(?:^|;\s*)auth_token=([^;]+)/)?.[1] ?? null;
}
