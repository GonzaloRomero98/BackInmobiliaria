import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { sinContrasena, UsuarioService } from "./usuario.service";
import { CrearUsuarioDto } from "./dto/crearUsuario.dto";
import { ActualizarUsuarioDto } from "./dto/actualizarUsuario.dto";
import { CambiarContrasenaDto } from "./dto/cambiarContrasena.dto";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";

type RequestConUsuario = Request & {user:{id:string}};

@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsuarioController{
    constructor(private readonly usuarioService:UsuarioService){}

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

    // Cualquier usuario del panel cambia su propia contraseña indicando la actual
    @Patch('me/contrasena')
    @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIO)
    cambiarContrasena(@Req() req:RequestConUsuario, @Body() dto:CambiarContrasenaDto){
        return this.usuarioService.cambiarContrasena(req.user.id, dto);
    }

    @Patch(':id')
    @Roles(RolUsuario.ADMIN)
    actualizarUsuario(@Param('id', ParseUUIDPipe) id:string, @Body() dto:ActualizarUsuarioDto, @Req() req:RequestConUsuario){
        return this.usuarioService.actualizarUsuario(id, dto, req.user.id);
    }
}
