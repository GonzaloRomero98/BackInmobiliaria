import { Body, Controller, HttpCode, Post, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { borrarCookieSesion, ponerCookieSesion } from "./cookie-sesion";

// Los usuarios se crean con POST /usuarios (ADMIN): no devuelve un token del usuario creado
@ApiTags('auth')
@Controller('auth')

export class AuthController{
    constructor(private readonly authService: AuthService){}

    // Máximo 5 intentos por minuto por IP contra fuerza bruta.
    // El token va solo en la cookie HttpOnly, nunca en el cuerpo de la respuesta.
    @Post('login')
    @Throttle({default:{limit:5, ttl:60_000}})
    async loginUsuario(@Body() loginDto: LoginDto, @Res({passthrough:true}) res: Response){
        const {access_token, usuario} = await this.authService.loginUsuario(loginDto);
        ponerCookieSesion(res, access_token);
        return {usuario};
    }

    // Sin guard: borrar la cookie no requiere sesión válida (puede estar vencida)
    @Post('logout')
    @HttpCode(204)
    cerrarSesion(@Res({passthrough:true}) res: Response){
        borrarCookieSesion(res);
    }
}
