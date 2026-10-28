import { Controller, Get, UseGuards } from "@nestjs/common";
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
}
