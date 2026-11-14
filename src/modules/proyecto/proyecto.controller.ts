import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ProyectoService } from "./proyecto.service";
import { CrearProyectoDto } from "./dto/crearProyecto.dto";
import { ActualizarProyectoDto } from "./dto/actualizarProyecto.dto";
import { NormativaDto } from "./dto/normativa.dto";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";

@ApiTags('proyectos')
@ApiBearerAuth()
@Controller('proyectos')
export class PoryectoController{
    constructor(private readonly proyectoService: ProyectoService){}

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    crearProyecto(@Body() proyectodto:CrearProyectoDto){
        return this.proyectoService.crearProyecto(proyectodto);
    }

    @Get()
    mostrarProyectos(@Query('id_ciudad', new ParseIntPipe({optional:true})) id_ciudad?:number){
        return this.proyectoService.mostrarProyectos(id_ciudad);
    }

    // Va antes de ':id' para que "admin" no se tome como un id.
    @Get('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    listarProyectosAdmin(){
        return this.proyectoService.listarProyectosAdmin();
    }

    @Get(':id')
    obtenerProyectosPorID(@Param('id', new ParseUUIDPipe) id:string){
        return this.proyectoService.obtenerProyectoPorID(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    actualizarProyecto(@Param('id', new ParseUUIDPipe) id:string, @Body() actualizarProyectoDto:ActualizarProyectoDto){
        return this.proyectoService.actualizarProyecto(id, actualizarProyectoDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    despublicarProyecto(@Param('id', new ParseUUIDPipe) id:string){
        return this.proyectoService.despublicarProyecto(id);
    }

    @Delete(':id/definitivo')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    async eliminarProyecto(@Param('id', new ParseUUIDPipe) id:string, @Res({passthrough:true}) res:Response){
        // Después de borrarlo ya no se puede buscar su nombre, así que queda en el detalle de la auditoría.
        res.locals.auditoriaDetalle = await this.proyectoService.eliminarProyecto(id);
    }

    @Patch(':id/publicar')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    publicarProyecto(@Param('id', new ParseUUIDPipe) id:string){
        return this.proyectoService.publicarProyecto(id);
    }

    @Get(':id/entorno')
    obtenerEntorno(@Param('id', new ParseUUIDPipe) id:string){
        return this.proyectoService.obtenerEntorno(id);
    }

    @Post(':id/entorno')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    actualizarEntorno(@Param('id', new ParseUUIDPipe) id:string){
        return this.proyectoService.actualizarEntorno(id);
    }

    @Get(':id/normativa')
    obtenerNormativa(@Param('id', new ParseUUIDPipe) id:string){
        return this.proyectoService.obtenerNormativa(id);
    }

    @Put(':id/normativa')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    guardarNormativa(@Param('id', new ParseUUIDPipe) id:string, @Body() normativaDto:NormativaDto){
        return this.proyectoService.guardarNormativa(id, normativaDto);
    }
}
