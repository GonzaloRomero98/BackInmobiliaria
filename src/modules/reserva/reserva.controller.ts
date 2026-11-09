import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ReservaService } from "./reserva.service";
import { CrearReservaDto } from "./dto/crearReserva.dto";
import { CambiarEstadoReservaDto } from "./dto/cambiarEstadoReserva.dto";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";

@ApiTags('reservas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
@Controller('reservas')
export class ReservaController{
    constructor(private readonly reservaService:ReservaService){}

    @Post()
    crear(@Body() dto:CrearReservaDto){
        return this.reservaService.crear(dto);
    }

    @Patch(':id/estado')
    cambiarEstado(@Param('id', ParseUUIDPipe) id:string, @Body() dto:CambiarEstadoReservaDto){
        return this.reservaService.cambiarEstado(id, dto.estado);
    }
}
