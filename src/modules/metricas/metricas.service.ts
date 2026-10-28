import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThanOrEqual, Repository } from "typeorm";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { Solicitud } from "../solicitud/entities/solicitud.entity";
import { Proyecto } from "../proyecto/entities/proyecto.entity";
import { EstadoModelo } from "../modeloCasa/modelo-casa.enum";

const DIA_MS = 24 * 60 * 60 * 1000;

// Resumen para la página de inicio del panel admin
@Injectable()
export class MetricasService{
    constructor(
        @InjectRepository(ModeloCasa)
        private readonly modeloCasaRepository: Repository<ModeloCasa>,
        @InjectRepository(Solicitud)
        private readonly solicitudRepository: Repository<Solicitud>,
        @InjectRepository(Proyecto)
        private readonly proyectoRepository: Repository<Proyecto>
    ){}

    async resumen(){
        const hace30Dias = new Date(Date.now() - 30 * DIA_MS);
        const [total, pendientes, ultimos30Dias, publicados, borradores, disponibles, reservados, vendidos, proyectosActivos, masSolicitados] = await Promise.all([
            this.solicitudRepository.count(),
            this.solicitudRepository.count({where:{contactado:false}}),
            this.solicitudRepository.count({where:{creadoEn:MoreThanOrEqual(hace30Dias)}}),
            this.modeloCasaRepository.count({where:{activo:true}}),
            this.modeloCasaRepository.count({where:{activo:false}}),
            this.modeloCasaRepository.count({where:{estado:EstadoModelo.DISPONIBLE}}),
            this.modeloCasaRepository.count({where:{estado:EstadoModelo.RESERVADO}}),
            this.modeloCasaRepository.count({where:{estado:EstadoModelo.VENDIDO}}),
            this.proyectoRepository.count({where:{activo:true}}),
            this.solicitudRepository.createQueryBuilder('s')
                .innerJoin('s.modeloCasa', 'm')
                .select('m.id', 'id')
                .addSelect('m.nombreModelo', 'nombreModelo')
                .addSelect('COUNT(s.id)', 'solicitudes')
                .groupBy('m.id')
                .orderBy('solicitudes', 'DESC')
                .limit(5)
                .getRawMany<{id:string, nombreModelo:string, solicitudes:string}>(),
        ]);

        return {
            solicitudes: {total, pendientes, ultimos30Dias},
            modelos: {publicados, borradores, disponibles, reservados, vendidos},
            proyectosActivos,
            // COUNT llega como string desde Postgres
            masSolicitados: masSolicitados.map((m) => ({...m, solicitudes: Number(m.solicitudes)})),
        };
    }
}
