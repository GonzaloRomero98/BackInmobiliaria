import { BadRequestException, Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { isEmail } from "class-validator";
import { SolicitudService } from "./solicitud.service";
import { CrearSolicitudDto } from "./dto/crearSolicitud.dto";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";

@ApiTags('solicitudes')
@Controller('solicitudes')
export class SolicitudController{
    constructor(private readonly solicitudService:SolicitudService){}

    // Formulario público: máximo 5 envíos por minuto por IP contra spam
    @Post()
    @Throttle({default:{limit:5, ttl:60_000}})
    crearSolicitud(@Body() crearSolicitudDto:CrearSolicitudDto){
        return this.solicitudService.crearSolicitud(crearSolicitudDto);
    }

    @Get()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    mostrarSolicitudes(){
        return this.solicitudService.mostrarSolicitudes()
    }

    @Get('exportar')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename="solicitudes.csv"')
    exportarSolicitudes(@Req() req:Request & {user:{id:string, correo:string, rol:string}}){
        return this.solicitudService.exportarCsv(req.user);
    }

    @Patch(':id/contactado')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    marcarContactado(@Param('id',ParseUUIDPipe) id:string){
        return this.solicitudService.marcarContactado(id);
    }

    // Derecho de supresión: borra todas las solicitudes de una persona
    @Delete()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    eliminarPorCorreo(@Query('correo') correo:string){
        if(!correo || !isEmail(correo)){
            throw new BadRequestException('Debe indicar un correo válido');
        }
        return this.solicitudService.eliminarPorCorreo(correo);
    }

    @Delete(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    eliminarSolicitud(@Param('id',ParseUUIDPipe) id:string){
        return this.solicitudService.eliminarSolicitud(id);
    }
}
