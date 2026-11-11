import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuditoriaService } from "./auditoria.service";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";
import { ListarAuditoriaDto } from "./dto/listarAuditoria.dto";

@ApiTags('auditoria')
@ApiBearerAuth()
@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
export class AuditoriaController{
    constructor(private readonly auditoriaService: AuditoriaService){}

    @Get()
    listar(@Query() filtros:ListarAuditoriaDto){
        return this.auditoriaService.listar(filtros);
    }

    // Recalcula la cadena de hashes completa y devuelve dónde se rompe, si se rompe
    @Get('verificar')
    verificar(){
        return this.auditoriaService.verificar();
    }
}
