import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Invitado } from "./entities/invitado.entity";
import { CrearSolicitudDTO } from "./entities/crearSolicitud.entity";

@Injectable()
export class InvitadoService{
    constructor(
        @InjectRepository(Invitado)
        private  readonly invitadoRepositorio : Repository<Invitado>,
    ){}

    async crearSolicitud(crearSolicitudDto: CrearSolicitudDTO):Promise<Invitado>{
        const solicitud = this.invitadoRepositorio.create({
            ...CrearSolicitudDTO,
            propiedad: {id: crearSolicitudDto.idPropiedad} as any,
        });
        return this.invitadoRepositorio.save(solicitud);
    }

    async verSolicitudes(): Promise<Invitado[]>{
        return this.invitadoRepositorio.find({
            order:{creado:'DESC'}
        });
    }

    async marcarContactado(id:string): Promise<Invitado>{
        await this.invitadoRepositorio.update(id, {contactado:true});
        return this.invitadoRepositorio.findOneOrFail({where:{id}});
    }
}