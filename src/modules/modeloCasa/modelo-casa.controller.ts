import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ModeloCasaService } from "./modelo-casa.service";
import { CrearModeloCasaDto } from "./dto/CrearModeloCasa.dto";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { FiltrosModeloCasaDto } from "./dto/filtrosModeloCasa.dto";
import { AgregarFotoDto } from "./dto/agregarFoto.dto";
import { ActualizarModeloCasaDto } from "./dto/actualizarModeloCasa.dto";
import { DuplicarModeloCasaDto } from "./dto/duplicarModeloCasa.dto";
import { OrdenarFotosDto } from "./dto/ordenarFotos.dto";

@ApiTags('modelos de casa')
@ApiBearerAuth()
@Controller('modeloCasa')
export class ModeloCasaController{
    constructor(private readonly modeloCasaService:ModeloCasaService){}

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    crearModeloCasa(@Body() crearmodeloCasaDto: CrearModeloCasaDto){
        return this.modeloCasaService.crearModeloCasa(crearmodeloCasaDto);
    }

    @Get()
    obtenerModelosCasa(@Query() filtros:FiltrosModeloCasaDto){
        return this.modeloCasaService.mostrarModelosCasa(filtros);
    }

    @Get('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    listarModelosAdmin(){
        return this.modeloCasaService.listarModelosAdmin();
    }

    // Declarada antes de admin/:id para que "nombre-disponible" no se tome como un id
    @Get('admin/nombre-disponible')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    nombreDisponible(
        @Query('nombre') nombre:string,
        @Query('excluirId', new ParseUUIDPipe({optional:true})) excluirId?:string,
    ){
        const limpio = typeof nombre === 'string' ? nombre.trim() : '';
        if(!limpio || limpio.length > 150){
            throw new BadRequestException('Debe indicar un nombre de 1 a 150 caracteres');
        }
        return this.modeloCasaService.nombreDisponible(limpio, excluirId);
    }

    @Get('admin/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    obtenerModeloAdmin(@Param('id', ParseUUIDPipe) id:string){
        return this.modeloCasaService.obtenerModeloAdmin(id);
    }

    @Get(':id')
    obtenerModeloCasaById(@Param('id', ParseUUIDPipe) id:string){
        return this.modeloCasaService.obtenerModeloByID(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    actualizarModeloCasa(@Param('id', ParseUUIDPipe) id:string, @Body() actualizarModeloCasaDto:ActualizarModeloCasaDto){
        return this.modeloCasaService.actualizarModeloCasa(id, actualizarModeloCasaDto);
    }

    @Delete(':id/definitivo')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    async eliminarModeloCasa(@Param('id', ParseUUIDPipe) id:string, @Res({passthrough:true}) res:Response){
        // Ya no existe para buscar su nombre: la auditoría lo guarda en el detalle
        res.locals.auditoriaDetalle = await this.modeloCasaService.eliminarModeloCasa(id);
    }

    @Post(':id/duplicar')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    duplicarModeloCasa(@Param('id', ParseUUIDPipe) id:string, @Body() dto:DuplicarModeloCasaDto){
        return this.modeloCasaService.duplicarModeloCasa(id, dto.nombreModelo);
    }

    @Post(':id/fotos')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    agregarFoto(@Param('id', ParseUUIDPipe) id:string, @Body() agregarFotoDto:AgregarFotoDto){
        return this.modeloCasaService.agregarFoto(id, agregarFotoDto);
    }

    @Put(':id/fotos/orden')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    ordenarFotos(@Param('id', ParseUUIDPipe) id:string, @Body() dto:OrdenarFotosDto){
        return this.modeloCasaService.ordenarFotos(id, dto.ids);
    }

    @Delete(':id/fotos/:foto_id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    elimninarFoto(@Param('id', ParseUUIDPipe) id:string, @Param('foto_id',ParseUUIDPipe) foto_id:string){
        return this.modeloCasaService.eliminarFoto(id, foto_id);        
    }
}