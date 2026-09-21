import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ModeloCasaService } from "./modelo-casa.service";
import { CrearModeloCasaDto } from "./dto/CrearModeloCasa.dto";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TipoOperacion } from "./modelo-casa.enum";

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
    obtenerModelosCasa(@Query('id_proyecto', new ParseUUIDPipe({optional:true})) id_proyecto?:string, @Query('tipoOperacion', new ParseEnumPipe(TipoOperacion,{optional:true}))tipoOperacion ?:TipoOperacion){
        return this.modeloCasaService.mostrarModelosCasa(id_proyecto, tipoOperacion);
    }

    @Get(':id')
    obtenerModeloCasaById(@Param('id', ParseUUIDPipe) id:string){
        return this.modeloCasaService.obtenerModeloByID(id);
    }
}