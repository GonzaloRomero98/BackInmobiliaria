import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { RegistrarEventoDto } from "./dto/registrarEvento.dto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { MetricasService } from "./metricas.service";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";

@ApiTags('metricas')
@ApiBearerAuth()
@Controller('metricas')
export class MetricasController{
    constructor(private readonly metricasService:MetricasService){}

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    resumen(){
        return this.metricasService.resumen();
    }

    // Es público porque lo llama la web. El límite por IP evita inflar la métrica.
    @Post('eventos')
    @HttpCode(204)
    @Throttle({default:{limit:20, ttl:60_000}})
    registrarEvento(@Body() dto:RegistrarEventoDto){
        return this.metricasService.registrarEvento(dto);
    }

    @Get('seguimiento')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.SECRETARIO, RolUsuario.ADMIN)
    seguimiento(){
        return this.metricasService.seguimiento();
    }
}
