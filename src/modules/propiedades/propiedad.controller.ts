import { Body, Controller, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PropiedadService } from "./propiedad.service";
import { Get } from "@nestjs/common";
import { CrearPropiedadDto } from "./entities/crearPropiedad.entity";
import { JwtAuthGUard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { RolUsuario } from "../usuario/entities/usuario.entity";
import { Roles } from "../auth/decorator/rol.decorator";

@Controller('propiedad')
export class PropiedadControler{
    constructor(private readonly propiedadService: PropiedadService){}

    @UseGuards(JwtAuthGUard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    @Post()
    crearPropiedad(@Body() propiedadDto: CrearPropiedadDto){
        return this.propiedadService.crearPropiedad(propiedadDto)
    }
    
    @Get()
    encontrarTodo(){
        return this.propiedadService.encontrarDisponibles();
    }

    @Get(':id')
    buscarPropiedadPorID(@Param('id') id:string){
        return this.propiedadService.buscarPropiedadPorID(id);
    }

    @UseGuards(JwtAuthGUard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    @Get('urlUpload/generar')
    obtenerUrlUpload(@Query('filename') filename:string,@Query('contentType') contentType:string){
        return this.propiedadService.subirUrl(filename, contentType);
    }


}