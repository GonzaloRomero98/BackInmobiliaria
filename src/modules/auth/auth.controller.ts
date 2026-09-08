import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CrearUsuarioDto } from "../usuario/entities/crearUsuario.entity";
import { LoginDto } from "./dto/login.dto";

@Controller('auth')

export class AuthController{
    constructor(private readonly authService: AuthService){}

    @Post('registrar')
    registrarUsuario(@Body() crearUsuarioDto: CrearUsuarioDto){
        return this.authService.registrarUsuario(crearUsuarioDto);
    }

    @Post('login')
    loginUsuario(@Body() loginDto: LoginDto){
        return this.authService.loginUsuario(loginDto);
    }
}