import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThanOrEqual, Repository } from "typeorm";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { Solicitud } from "../solicitud/entities/solicitud.entity";
import { Proyecto } from "../proyecto/entities/proyecto.entity";

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
        const [total, pendientes, ultimos30Dias, publicados, borradores, casas, proyectosActivos, masSolicitados] = await Promise.all([
            this.solicitudRepository.count(),
            this.solicitudRepository.count({where:{contactado:false}}),
            this.solicitudRepository.count({where:{creadoEn:MoreThanOrEqual(hace30Dias)}}),
            this.modeloCasaRepository.count({where:{activo:true}}),
            this.modeloCasaRepository.count({where:{activo:false}}),
            // Casas (unidades) de los modelos publicados, no cantidad de modelos
            this.modeloCasaRepository.createQueryBuilder('m')
                .select('SUM(m.unidades)', 'unidades')
                .addSelect('SUM(m.unidadesReservadas)', 'reservados')
                .addSelect('SUM(m.unidadesVendidas)', 'vendidos')
                .where('m.activo = true')
                .getRawOne<{unidades:string|null, reservados:string|null, vendidos:string|null}>(),
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

        // SUM llega como string, o null si no hay modelos
        const unidades = Number(casas?.unidades ?? 0);
        const reservados = Number(casas?.reservados ?? 0);
        const vendidos = Number(casas?.vendidos ?? 0);

        return {
            solicitudes: {total, pendientes, ultimos30Dias},
            modelos: {publicados, borradores, unidades, disponibles: unidades - reservados - vendidos, reservados, vendidos},
            proyectosActivos,
            // COUNT llega como string desde Postgres
            masSolicitados: masSolicitados.map((m) => ({...m, solicitudes: Number(m.solicitudes)})),
        };
    }
}
