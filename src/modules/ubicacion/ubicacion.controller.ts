import { Controller, Get, Query } from "@nestjs/common";
import { UbicacionService } from "./ubicacion.service";

@Controller('ubicacion')
export class UbicacionController{
    constructor(private readonly ubiaccionService:UbicacionService){}

    @Get('ciudades')
    encontrarCiudades(@Query('id_region') id_region?:string){
        if(id_region){
            return this.ubiaccionService.encontrarCiudadPorRegion(+id_region);
        }
        return ''
    }
}