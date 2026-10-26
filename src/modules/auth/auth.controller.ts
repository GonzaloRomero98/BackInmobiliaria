import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { CrearUsuarioDto } from "../usuario/dto/crearUsuario.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwtAuth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";

@ApiTags('auth')
@Controller('auth')

export class AuthController{
    constructor(private readonly authService: AuthService){}

    @Post('registrar')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    registrarUsuario(@Body() crearUsuarioDto: CrearUsuarioDto){
        return this.authService.registrarUsuario(crearUsuarioDto);
    }

    // Máximo 5 intentos por minuto por IP contra fuerza bruta
    @Post('login')
    @Throttle({default:{limit:5, ttl:60_000}})
    loginUsuario(@Body() loginDto: LoginDto){
        return this.authService.loginUsuario(loginDto);
    }
}
