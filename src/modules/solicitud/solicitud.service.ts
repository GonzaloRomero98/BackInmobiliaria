import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Solicitud } from "./entities/solicitud.entity";
import { LessThan, Repository } from "typeorm";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { CrearSolicitudDto } from "./dto/crearSolicitud.dto";
import { AuditoriaService } from "../auditoria/auditoria.service";

const RETENCION_DIAS_POR_DEFECTO = 365;

@Injectable()
export class SolicitudService{
    constructor(
        @InjectRepository(Solicitud)
        private readonly solicitudRepository : Repository<Solicitud>,
        @InjectRepository(ModeloCasa)
        private readonly modeloCasaRepostory : Repository<ModeloCasa>,
        private readonly configService: ConfigService,
        private readonly auditoriaService: AuditoriaService
    ){}

    async crearSolicitud(crearSolicitudDto:CrearSolicitudDto):Promise<Solicitud>{
        const modeloCasa = await this.modeloCasaRepostory.findOne({where:{id:crearSolicitudDto.id_modelo_casa, activo:true, proyecto:{activo:true}}});

        if(!modeloCasa){
            throw new NotFoundException('El modelo de la casa ingresado no existe');
        }

        const solicitud = new Solicitud();
            solicitud.nombre = crearSolicitudDto.nombre;
            solicitud.apellido = crearSolicitudDto.apellido;
            solicitud.correo = crearSolicitudDto.correo;
            solicitud.celular = crearSolicitudDto.celular;
            solicitud.mensaje = crearSolicitudDto.mensaje ?? null;
            solicitud.consentimientoEn = new Date();
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

    async eliminarSolicitud(id:string):Promise<void>{
        const resultado = await this.solicitudRepository.delete({id});
        if(!resultado.affected){
            throw new NotFoundException('Solicitud no encontrada');
        }
    }

    // Comparación exacta sin distinguir mayúsculas (sin LIKE, para que "_" o "%" no actúen como comodines)
    async eliminarPorCorreo(correo:string):Promise<{eliminadas:number}>{
        const resultado = await this.solicitudRepository.createQueryBuilder()
            .delete()
            .where('LOWER(correo) = LOWER(:correo)', {correo})
            .execute();
        return {eliminadas: resultado.affected ?? 0};
    }

    // Política de retención: los datos personales de las solicitudes se borran al cumplir el plazo
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async eliminarVencidas():Promise<number>{
        const dias = Number(this.configService.get('SOLICITUD_RETENCION_DIAS') ?? RETENCION_DIAS_POR_DEFECTO);
        const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
        const resultado = await this.solicitudRepository.delete({creadoEn: LessThan(limite)});
        const eliminadas = resultado.affected ?? 0;

        await this.auditoriaService.registrar({
            accion:'RETENCION_SOLICITUDES',
            exito:true,
            detalle:{dias, eliminadas},
        });
        return eliminadas;
    }
}
