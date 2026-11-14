import { BadRequestException, Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { isEmail } from "class-validator";
import { SolicitudService } from "./solicitud.service";
import { CrearSolicitudDto } from "./dto/crearSolicitud.dto";
import { ListarSolicitudesDto } from "./dto/listarSolicitudes.dto";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";
import { CrearSolicitudPanelDto } from "./dto/crearSolicitudPanel.dto";
import { CrearNotaDto } from "./dto/crearNota.dto";
import { ActualizarVisitaDto } from "./dto/actualizarVisita.dto";
import { CrearCotizacionDto } from "./dto/crearCotizacion.dto";
import { CorregirDatosSolicitudDto } from "./dto/corregirDatosSolicitud.dto";

type RequestConUsuario = Request & {user:{id:string, correo:string, rol:string}};

@ApiTags('solicitudes')
@Controller('solicitudes')
export class SolicitudController{
    constructor(private readonly solicitudService:SolicitudService){}

    @Post()
    // Formulario público: máximo 5 envíos por minuto por IP contra el spam.
    @Throttle({default:{limit:5, ttl:60_000}})
    crearSolicitud(@Body() crearSolicitudDto:CrearSolicitudDto){
        return this.solicitudService.crearSolicitud(crearSolicitudDto);
    }

    @Post('panel')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    crearDesdePanel(@Body() dto:CrearSolicitudPanelDto){
        return this.solicitudService.crearDesdePanel(dto);
    }

    @Get()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    listarSolicitudes(@Query() query:ListarSolicitudesDto){
        return this.solicitudService.listarSolicitudes(query);
    }

    @Get('exportar')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    @Header('Content-Type', 'text/csv; charset=utf-8')
    @Header('Content-Disposition', 'attachment; filename="solicitudes.csv"')
    exportarSolicitudes(@Req() req:RequestConUsuario){
        return this.solicitudService.exportarCsv(req.user);
    }

    // Solo el número de pendientes, sin datos personales, por eso no se audita.
    @Get('resumen')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    resumen(){
        return this.solicitudService.resumen();
    }

    // Va después de 'exportar' y 'resumen' para que esas rutas no se tomen como :id.
    @Get(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    obtenerSolicitud(@Param('id',ParseUUIDPipe) id:string){
        return this.solicitudService.obtenerSolicitud(id);
    }

    @Patch(':id/contactado')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    marcarContactado(@Param('id',ParseUUIDPipe) id:string){
        return this.solicitudService.marcarContactado(id);
    }

    @Post(':id/notas')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    agregarNota(@Param('id',ParseUUIDPipe) id:string, @Body() dto:CrearNotaDto, @Req() req:RequestConUsuario){
        return this.solicitudService.agregarNota(id, dto.texto, req.user.id);
    }

    @Patch(':id/visita')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    actualizarVisita(@Param('id',ParseUUIDPipe) id:string, @Body() dto:ActualizarVisitaDto, @Req() req:RequestConUsuario){
        return this.solicitudService.actualizarVisita(id, dto, req.user.id);
    }

    @Post(':id/cotizaciones')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    emitirCotizacion(@Param('id',ParseUUIDPipe) id:string, @Body() dto:CrearCotizacionDto, @Req() req:RequestConUsuario){
        return this.solicitudService.emitirCotizacion(id, dto, req.user.id);
    }

    // Derecho de rectificación: corrige nombre, apellido, correo o celular.
    @Patch(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    corregirDatos(@Param('id',ParseUUIDPipe) id:string, @Body() dto:CorregirDatosSolicitudDto, @Req() req:RequestConUsuario){
        return this.solicitudService.corregirDatos(id, dto, req.user.id);
    }

    // Derecho de supresión: borra todas las solicitudes de una persona.
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
