import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { sinContrasena, UsuarioService } from "./usuario.service";
import { CrearUsuarioDto } from "./dto/crearUsuario.dto";
import { ActualizarUsuarioDto } from "./dto/actualizarUsuario.dto";
import { CambiarContrasenaDto } from "./dto/cambiarContrasena.dto";
import { ActualizarPerfilDto } from "./dto/actualizarPerfil.dto";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";
import { AuthService } from "../auth/auth.service";

type RequestConUsuario = Request & {user:{id:string, correo:string, rol:string}};

@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsuarioController{
    constructor(private readonly usuarioService:UsuarioService, private readonly authService:AuthService){}

    @Get()
    @Roles(RolUsuario.ADMIN)
    listarUsuarios(){
        return this.usuarioService.listarUsuarios();
    }

    @Post()
    @Roles(RolUsuario.ADMIN)
    async crearUsuario(@Body() crearUsuarioDto:CrearUsuarioDto){
        return sinContrasena(await this.usuarioService.crearUsuario(crearUsuarioDto));
    }

    // Rutas "me" declaradas antes de ':id' para que Nest no las tome como un id
    @Get('me')
    @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIO)
    miPerfil(@Req() req:RequestConUsuario){
        return this.usuarioService.miPerfil(req.user.id);
    }

    @Patch('me')
    @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIO)
    actualizarPerfil(@Req() req:RequestConUsuario, @Body() dto:ActualizarPerfilDto){
        return this.usuarioService.actualizarPerfil(req.user.id, dto);
    }

    // Cualquier usuario del panel cambia su propia contraseña indicando la actual
    @Patch('me/contrasena')
    @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIO)
    // El cambio invalida todos los tokens anteriores: se devuelve uno nuevo para que esta sesión siga abierta
    async cambiarContrasena(@Req() req:RequestConUsuario, @Body() dto:CambiarContrasenaDto){
        await this.usuarioService.cambiarContrasena(req.user.id, dto);
        return this.authService.emitirToken(req.user);
    }

    @Patch(':id')
    @Roles(RolUsuario.ADMIN)
    actualizarUsuario(@Param('id', ParseUUIDPipe) id:string, @Body() dto:ActualizarUsuarioDto, @Req() req:RequestConUsuario){
        return this.usuarioService.actualizarUsuario(id, dto, req.user.id);
    }
}
