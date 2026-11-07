import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

// Los usuarios se crean con POST /usuarios (ADMIN): no devuelve un token del usuario creado
@ApiTags('auth')
@Controller('auth')

export class AuthController{
    constructor(private readonly authService: AuthService){}

    // Máximo 5 intentos por minuto por IP contra fuerza bruta
    @Post('login')
    @Throttle({default:{limit:5, ttl:60_000}})
    loginUsuario(@Body() loginDto: LoginDto){
        return this.authService.loginUsuario(loginDto);
    }
}
