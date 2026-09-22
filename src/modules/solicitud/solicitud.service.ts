import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Solicitud } from "./entities/solicitud.entity";
import { Repository } from "typeorm";
import { ModeloCasa } from "../modelo-casa/entities/modeloCasa.entity";
import { CrearSolicitudDto } from "./dto/crearSolicitud.dto";
@Injectable()
export class SolicitudService{
    constructor(
        @InjectRepository(Solicitud)
        private readonly solicitudRepository : Repository<Solicitud>,
        @InjectRepository(ModeloCasa)
        private readonly modeloCasaRepostory : Repository<ModeloCasa>
    ){}

    async crearSolicitud(crearSolicitudDto:CrearSolicitudDto):Promise<Solicitud>{
        const modeloCasa = await this.modeloCasaRepostory.findOne({where:{id:crearSolicitudDto.id_modelo_casa}});

        if(!modeloCasa){
            throw new NotFoundException('El modelo de la casa ingresado no existe');      
        }

        const solicitud = new Solicitud();
            solicitud.nombre = crearSolicitudDto.nombre;
            solicitud.apellido = crearSolicitudDto.apellido;
            solicitud.correo = crearSolicitudDto.correo;
            solicitud.celular = crearSolicitudDto.celular;
            solicitud.mensjae = crearSolicitudDto.mensaje ?? null;
            solicitud.modeloCasa = modeloCasa;
        
        return this.solicitudRepository.save(solicitud);
    }

    mostrarSolicitudes(): Promise<Solicitud[]>{
        return this.solicitudRepository.find({relations:{modeloCasa:true},order:{creadoEn:'DESC'}})
    }

    async marcarContactado(id:string):Promise<Solicitud>{
        const solicitud = await this.solicitudRepository.findOne({where:{id}});
        if(!solicitud){
            throw new NotFoundException('Solicitud no encontrada');
        }

        solicitud.contactado= true;
        return this.solicitudRepository.save(solicitud);
    }
}