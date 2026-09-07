import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { InvitadoService } from "./invitado.service";
import { CrearSolicitudDTO } from "./entities/crearSolicitud.entity";

@Controller('invitado')
export class InvitadoController{
    constructor(private readonly invitadoService:InvitadoService){}

    @Post()
    crearFormulario (@Body() crearSolicitudDto: CrearSolicitudDTO){
        return this.invitadoService.crearSolicitud(crearSolicitudDto);
    }

    @Get()
    mostrarSolicitudes(){
        return this.invitadoService.verSolicitudes();
    }

    @Patch(':id/contactado')
    marcarContactado(@Param(':id') id:string){
        return this.invitadoService.marcarContactado(id);
    }
}