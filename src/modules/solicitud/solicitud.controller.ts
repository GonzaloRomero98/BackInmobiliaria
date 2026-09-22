import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { SolicitudService } from "./solicitud.service";
import { CrearSolicitudDto } from "./dto/crearSolicitud.dto";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";

@Controller('solicitudes')
export class SolicitudController{
    constructor(private readonly solicitudService:SolicitudService){}

    @Post()
    crearSolicitud(@Body() crearSolicitudDto:CrearSolicitudDto){
        return this.solicitudService.crearSolicitud(crearSolicitudDto);
    }

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO)
    mostrarSolicitudes(){
        return this.solicitudService.mostrarSolicitudes()
    }

    @Patch(':id/contactado')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO)
    marcarContactado(@Param('id',ParseUUIDPipe) id:string){
        return this.solicitudService.marcarContactado(id);
    }

    
}