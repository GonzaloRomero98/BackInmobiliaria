import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuditoriaService } from "./auditoria.service";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorator/rol.decorator";
import { RolUsuario } from "../rol/rol.enum";

@ApiTags('auditoria')
@ApiBearerAuth()
@Controller('auditoria')
export class AuditoriaController{
    constructor(private readonly auditoriaService: AuditoriaService){}

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    listar(
        @Query('pagina', new DefaultValuePipe(1), ParseIntPipe) pagina:number,
        @Query('limite', new DefaultValuePipe(50), ParseIntPipe) limite:number,
    ){
        return this.auditoriaService.listar(Math.max(pagina, 1), Math.min(Math.max(limite, 1), 200));
    }
}
