import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ModeloCasaService } from "./modelo-casa.service";
import { CrearModeloCasaDto } from "./dto/CrearModeloCasa.dto";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { FiltrosModeloCasaDto } from "./dto/filtrosModeloCasa.dto";
import { AgregarFotoDto } from "./dto/agregarFoto.dto";
import { ActualizarModeloCasaDto } from "./dto/actualizarModeloCasa.dto";

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

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    despublicarModeloCasa(@Param('id', ParseUUIDPipe) id:string){
        return this.modeloCasaService.despublicarModeloCasa(id);
    }

    @Post(':id/fotos')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    agregarFoto(@Param('id', ParseUUIDPipe) id:string, @Body() agregarFotoDto:AgregarFotoDto){
        return this.modeloCasaService.agregarFoto(id, agregarFotoDto);
    }

    @Delete(':id/fotos/:foto_id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    elimninarFoto(@Param('id', ParseUUIDPipe) id:string, @Param('foto_id',ParseUUIDPipe) foto_id:string){
        return this.modeloCasaService.eliminarFoto(id, foto_id);        
    }
}