import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CaracteristicaService } from "./caracteristica.service";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";
import { CrearCaractersiticaDto } from "./dto/crearCaracteristica.dto";

@Controller('caracteristicas')
export class CaracteristicasController{
    constructor(
        private readonly caractersiticaService: CaracteristicaService
    ){}

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    crearCaracteristica(@Body() crearCaracteristicaDto:CrearCaractersiticaDto){
        return this.caractersiticaService.crearCaracteristica(crearCaracteristicaDto);
    }

    @Get()
    obtenerCaractersiticas(){
        return this.caractersiticaService.obtenerCaractersiticas();
    }

}