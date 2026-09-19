import { Controller, Get, ParseIntPipe, Query } from "@nestjs/common";
import { UbicacionService } from "./ubicacion.service";

@Controller('ubicacion')
export class UbicacionController{
    constructor(private readonly ubiaccionService:UbicacionService){}

    @Get('regiones')
    encontrarRegiones(){
        return this.ubiaccionService.obtenerRegiones();
    }

    @Get('ciudades')
    encontrarCiudades(@Query('id_region',new ParseIntPipe({optional:true})) id_region?: number){
        return this.ubiaccionService.obtenerCiudades(id_region);
    }
}