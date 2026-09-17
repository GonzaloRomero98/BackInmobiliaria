import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { UbicacionService } from "./ubicacion.service";
import { Ciudad } from "./entities/ciudad.entity";
import { Region } from "./entities/region.entity";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../usuario/entities/usuario.entity";

@Controller('ubicacion')
export class UbicacionController{
    constructor(private readonly ubiaccionService:UbicacionService){}

    @UseGuards(JwtAuthGuard,RolesGuard)
    @Roles(RolUsuario.ADMIN)
    @Post()
    crearCiudad(@Body() ciudaddTO:Ciudad){
        return this.ubiaccionService.crearCiudad(ciudaddTO);
    }
    
    @UseGuards(JwtAuthGuard,RolesGuard)
    @Roles(RolUsuario.ADMIN)
    @Post()
    crearRegion(@Body() RegionDto:Region){
        return this.ubiaccionService.crearRegion(RegionDto);
    }

    @Get('ciudades')
    encontrarCiudades(@Query('id_region') id_region?:string){
        if(id_region){
            return this.ubiaccionService.encontrarCiudadPorRegion(+id_region);
        }
        return ''
    }
}