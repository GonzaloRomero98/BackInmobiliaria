import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Controller, Get, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { UbicacionService } from "./ubicacion.service";
import { DireccionService } from "./direccion.service";
import { ConsultarDireccionDto } from "./dto/consultarDireccion.dto";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";

@ApiTags('ubicacion')
@Controller('ubicacion')
export class UbicacionController{
    constructor(
        private readonly ubiaccionService:UbicacionService,
        private readonly direccionService:DireccionService,
    ){}

    @Get('regiones')
    encontrarRegiones(){
        return this.ubiaccionService.obtenerRegiones();
    }

    @Get('ciudades')
    encontrarCiudades(@Query('id_region',new ParseIntPipe({optional:true})) id_region?: number){
        return this.ubiaccionService.obtenerCiudades(id_region);
    }

    // Convierte el punto del mapa en calle y número. Solo el admin, porque cada consulta sale a un servicio externo.
    @Get('direccion')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    async buscarDireccion(@Query() {latitud, longitud}:ConsultarDireccionDto){
        return {direccion: await this.direccionService.buscar(latitud, longitud)};
    }
}
