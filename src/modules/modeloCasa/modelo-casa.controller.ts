import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
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
import { NombreDisponibleDto } from "./dto/nombreDisponible.dto";
import { ModeloCasa } from "./entities/modeloCasa.entity";

@ApiTags('modelos de casa')
@ApiBearerAuth()
@Controller('modeloCasa')
export class ModeloCasaController{
    constructor(private readonly modeloCasaService:ModeloCasaService){}

    // Si el admin confirmó guardar excediendo la normativa, queda en el detalle de la auditoría.
    private async auditarExceso(modelo:ModeloCasa, confirmado:boolean | undefined, res:Response){
        if(!confirmado) return;
        const exceso = await this.modeloCasaService.excesoDeNormativa(modelo);
        if(exceso) res.locals.auditoriaDetalle = {excesoNormativa:exceso};
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    async crearModeloCasa(@Body() crearmodeloCasaDto: CrearModeloCasaDto, @Res({passthrough:true}) res:Response){
        const modelo = await this.modeloCasaService.crearModeloCasa(crearmodeloCasaDto);
        await this.auditarExceso(modelo, crearmodeloCasaDto.confirmarExceso, res);
        return modelo;
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

    // Va antes de admin/:id para que "nombre-disponible" no se tome como un id.
    @Get('admin/nombre-disponible')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    nombreDisponible(@Query() {nombre, excluirId}:NombreDisponibleDto){
        return this.modeloCasaService.nombreDisponible(nombre, excluirId);
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
    async actualizarModeloCasa(@Param('id', ParseUUIDPipe) id:string, @Body() actualizarModeloCasaDto:ActualizarModeloCasaDto, @Res({passthrough:true}) res:Response){
        const modelo = await this.modeloCasaService.actualizarModeloCasa(id, actualizarModeloCasaDto);
        await this.auditarExceso(modelo, actualizarModeloCasaDto.confirmarExceso, res);
        return modelo;
    }

    @Delete(':id/definitivo')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    async eliminarModeloCasa(@Param('id', ParseUUIDPipe) id:string, @Res({passthrough:true}) res:Response){
        // Después de borrarlo ya no se puede buscar su nombre, así que queda en el detalle de la auditoría.
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