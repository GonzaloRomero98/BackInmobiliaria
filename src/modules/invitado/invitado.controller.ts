import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { InvitadoService } from "./invitado.service";
import { CrearSolicitudDTO } from "./entities/crearSolicitud.entity";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../usuario/entities/usuario.entity";

@Controller('invitado')
export class InvitadoController{
    constructor(private readonly invitadoService:InvitadoService){}

    @Post()
    crearFormulario (@Body() crearSolicitudDto: CrearSolicitudDTO){
        return this.invitadoService.crearSolicitud(crearSolicitudDto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIA)
    @Get()
    mostrarSolicitudes(){
        return this.invitadoService.verSolicitudes();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIA, RolUsuario.ADMIN)
    @Patch(':id/contactado')
    marcarContactado(@Param(':id') id:string){
        return this.invitadoService.marcarContactado(id);
    }
}