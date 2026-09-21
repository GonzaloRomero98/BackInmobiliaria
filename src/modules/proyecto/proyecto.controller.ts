import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ProyectoService } from "./proyecto.service";
import { CrearProyectoDto } from "./dto/crearProyecto.dto";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";

@Controller('proyectos')
export class PoryectoController{
    constructor(private readonly proyectoService: ProyectoService){}

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    crearProyecto(@Body() proyectodto:CrearProyectoDto){
        return this.proyectoService.crearProyecto(proyectodto);
    }

    @Get()
    mostrarProyectos(@Query('id_ciudad', new ParseIntPipe({optional:true})) id_ciudad?:number){
        return this.proyectoService.mostrarProyectos(id_ciudad);
    }

    @Get(':id')
    obtenerProyectosPorID(@Param('id', new ParseUUIDPipe) id:string){
        return this.proyectoService.obtenerProyectoPorID(id);
    }
}