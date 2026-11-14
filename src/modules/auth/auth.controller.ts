import { Body, Controller, HttpCode, Ip, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { borrarCookieSesion, extraerToken, ponerCookieSesion } from "./cookie-sesion";

@ApiTags('auth')
@Controller('auth')

export class AuthController{
    constructor(private readonly authService: AuthService){}

    // Máximo 5 intentos por minuto por IP. El token va solo en la cookie HttpOnly, nunca en la respuesta.
    @Post('login')
    @Throttle({default:{limit:5, ttl:60_000}})
    async loginUsuario(@Body() loginDto: LoginDto, @Ip() ip: string, @Res({passthrough:true}) res: Response){
        const {access_token, usuario} = await this.authService.loginUsuario(loginDto, ip);
        ponerCookieSesion(res, access_token);
        return {usuario};
    }

    // Sin guard, porque la sesión puede estar vencida y aun así hay que borrar la cookie.
    // La cookie se borra primero, así el navegador sale aunque falle el registro del token cerrado.
    @Post('logout')
    @HttpCode(204)
    async cerrarSesion(@Req() req: Request, @Res({passthrough:true}) res: Response){
        borrarCookieSesion(res);
        await this.authService.cerrarSesion(extraerToken(req));
    }
}
