import { Body, Controller, Param, Post, Query } from "@nestjs/common";
import { PropiedadService } from "./propiedad.service";
import { Get } from "@nestjs/common";
import { CrearPropiedadDto } from "./entities/crearPropiedad.entity";

@Controller('propiedad')
export class PropiedadControler{
    constructor(private readonly propiedadService: PropiedadService){}


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

    @Get('urlUpload/generar')
    obtenerUrlUpload(@Query('filename') filename:string,@Query('contentType') contentType:string){
        return this.propiedadService.subirUrl(filename, contentType);
    }


}