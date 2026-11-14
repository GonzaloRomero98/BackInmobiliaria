import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { And, LessThan, MoreThanOrEqual, Repository } from "typeorm";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { Solicitud } from "../solicitud/entities/solicitud.entity";
import { Proyecto } from "../proyecto/entities/proyecto.entity";
import { Reserva } from "../reserva/entities/reserva.entity";
import { EstadoReserva } from "../reserva/reserva.enum";
import { EventoModelo, TipoEventoModelo } from "./entities/eventoModelo.entity";
import { RegistrarEventoDto } from "./dto/registrarEvento.dto";

const DIA_MS = 24 * 60 * 60 * 1000;
export const SEMANAS_GRAFICO = 8;

// Lunes a las 00:00 de la semana de la fecha, en la hora del servidor.
export function inicioSemana(fecha: Date): Date {
    const lunes = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    return lunes;
}

const claveDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

@Injectable()
export class MetricasService{
    constructor(
        @InjectRepository(ModeloCasa)
        private readonly modeloCasaRepository: Repository<ModeloCasa>,
        @InjectRepository(Solicitud)
        private readonly solicitudRepository: Repository<Solicitud>,
        @InjectRepository(Proyecto)
        private readonly proyectoRepository: Repository<Proyecto>,
        @InjectRepository(Reserva)
        private readonly reservaRepository: Repository<Reserva>,
        @InjectRepository(EventoModelo)
        private readonly eventoRepository: Repository<EventoModelo>,
    ){}

    // Solo cuenta modelos publicados, así un id inventado no suma.
    async registrarEvento({id_modelo_casa, tipo}:RegistrarEventoDto):Promise<void>{
        if(!(await this.modeloCasaRepository.exists({where:{id:id_modelo_casa, activo:true}}))){
            throw new NotFoundException('Modelo no encontrado');
        }
        await this.eventoRepository.save({tipo, modeloCasa:{id:id_modelo_casa}});
    }

    async resumen(ahora = new Date()){
        const hace30Dias = new Date(ahora.getTime() - 30 * DIA_MS);
        const hace60Dias = new Date(ahora.getTime() - 60 * DIA_MS);
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        const primeraSemana = inicioSemana(ahora);
        primeraSemana.setDate(primeraSemana.getDate() - 7 * (SEMANAS_GRAFICO - 1));

        const [total, pendientes, ultimos30Dias, previos30Dias, publicados, borradores, casas, proyectosActivos,
            reservasMes, ventasMes, visitas, porSemana, masSolicitados, escaneosQr, sesionesAr] = await Promise.all([
            this.solicitudRepository.count(),
            this.solicitudRepository.count({where:{contactado:false}}),
            this.solicitudRepository.count({where:{creadoEn:MoreThanOrEqual(hace30Dias)}}),
            this.solicitudRepository.count({where:{creadoEn:And(MoreThanOrEqual(hace60Dias), LessThan(hace30Dias))}}),
            this.modeloCasaRepository.count({where:{activo:true}}),
            this.modeloCasaRepository.count({where:{activo:false}}),
            this.modeloCasaRepository.createQueryBuilder('m')
                .select('SUM(m.unidades)', 'unidades')
                .addSelect('SUM(m.unidadesReservadas)', 'reservados')
                .addSelect('SUM(m.unidadesVendidas)', 'vendidos')
                .where('m.activo = true')
                .getRawOne<{unidades:string|null, reservados:string|null, vendidos:string|null}>(),
            this.proyectoRepository.count({where:{activo:true}}),
            this.reservaRepository.count({where:{creadoEn:MoreThanOrEqual(inicioMes)}}),
            this.reservaRepository.count({where:{estado:EstadoReserva.VENDIDA, actualizadoEn:MoreThanOrEqual(inicioMes)}}),
            this.proximasVisitas(ahora, 5),
            this.solicitudRepository.createQueryBuilder('s')
                .select(`date_trunc('week', s.creadoEn)`, 'semana')
                .addSelect('COUNT(*)', 'solicitudes')
                .where('s.creadoEn >= :desde', {desde:primeraSemana})
                .groupBy('semana')
                .getRawMany<{semana:Date, solicitudes:string}>(),
            this.solicitudRepository.createQueryBuilder('s')
                .innerJoin('s.modeloCasa', 'm')
                .innerJoin('m.proyecto', 'p')
                .select('m.id', 'id')
                .addSelect('m.nombreModelo', 'nombreModelo')
                .addSelect('p.nombre', 'proyecto')
                .addSelect('COUNT(s.id)', 'solicitudes')
                .groupBy('m.id')
                .addGroupBy('p.id')
                .orderBy('solicitudes', 'DESC')
                .limit(5)
                .getRawMany<{id:string, nombreModelo:string, proyecto:string, solicitudes:string}>(),
            this.eventoRepository.count({where:{tipo:TipoEventoModelo.QR_ESCANEADO, creadoEn:MoreThanOrEqual(hace30Dias)}}),
            this.eventoRepository.count({where:{tipo:TipoEventoModelo.AR_INICIADA, creadoEn:MoreThanOrEqual(hace30Dias)}}),
        ]);

        const unidades = Number(casas?.unidades ?? 0);
        const reservados = Number(casas?.reservados ?? 0);
        const vendidos = Number(casas?.vendidos ?? 0);

        const conteoSemana = new Map(porSemana.map((s) => [claveDia(new Date(s.semana)), Number(s.solicitudes)]));
        const semanas = Array.from({length:SEMANAS_GRAFICO}, (_, i) => {
            const lunes = new Date(primeraSemana);
            lunes.setDate(primeraSemana.getDate() + 7 * i);
            return {semana:claveDia(lunes), solicitudes:conteoSemana.get(claveDia(lunes)) ?? 0};
        });

        return {
            solicitudes: {total, pendientes, ultimos30Dias, previos30Dias, porSemana:semanas},
            modelos: {publicados, borradores, unidades, disponibles: unidades - reservados - vendidos, reservados, vendidos},
            proyectosActivos,
            reservas: {reservasMes, ventasMes},
            visitas,
            masSolicitados: masSolicitados.map((m) => ({...m, solicitudes: Number(m.solicitudes)})),
            experiencia3d: {escaneosQr, sesionesAr},
        };
    }

    // Trae nombres y celulares, por eso GET /metricas/seguimiento se audita como lectura de datos personales.
    async seguimiento(ahora = new Date()){
        const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        const [[porContactar, pendientes], nuevasHoy, nuevasSemana, visitas, [reservas, reservasEnCurso], ventasMes] = await Promise.all([
            this.solicitudRepository.findAndCount({
                where:{contactado:false}, relations:{modeloCasa:{proyecto:true}}, order:{creadoEn:'ASC'}, take:5,
            }),
            this.solicitudRepository.count({where:{creadoEn:MoreThanOrEqual(inicioDia)}}),
            this.solicitudRepository.count({where:{creadoEn:MoreThanOrEqual(inicioSemana(ahora))}}),
            this.proximasVisitas(ahora, 8),
            this.reservaRepository.findAndCount({
                where:{estado:EstadoReserva.RESERVADA}, relations:{solicitud:{modeloCasa:{proyecto:true}}}, order:{creadoEn:'ASC'}, take:5,
            }),
            this.reservaRepository.count({where:{estado:EstadoReserva.VENDIDA, actualizadoEn:MoreThanOrEqual(inicioMes)}}),
        ]);
        return {
            solicitudes: {
                pendientes, nuevasHoy, nuevasSemana,
                porContactar: porContactar.map((s) => ({
                    id:s.id, nombre:s.nombre, apellido:s.apellido, celular:s.celular, creadoEn:s.creadoEn,
                    visitaPreferida:s.visitaPreferida, ...modeloYProyecto(s),
                })),
            },
            visitas,
            reservas: {
                enCurso: reservasEnCurso,
                ventasMes,
                porCerrar: reservas.map((r) => ({
                    id:r.id, idSolicitud:r.solicitud.id, nombre:r.solicitud.nombre, apellido:r.solicitud.apellido,
                    lote:r.lote, creadoEn:r.creadoEn, ...modeloYProyecto(r.solicitud),
                })),
            },
        };
    }

    private async proximasVisitas(ahora: Date, limite: number){
        const [visitas, total] = await this.solicitudRepository.findAndCount({
            where:{visitaPreferida:And(MoreThanOrEqual(ahora), LessThan(new Date(ahora.getTime() + 7 * DIA_MS)))},
            relations:{modeloCasa:{proyecto:true}},
            order:{visitaPreferida:'ASC'},
            take:limite,
        });
        return {
            proximos7Dias: total,
            proximas: visitas.map((v) => ({
                id:v.id, nombre:v.nombre, apellido:v.apellido, visitaPreferida:v.visitaPreferida, visitaEstado:v.visitaEstado, ...modeloYProyecto(v),
            })),
        };
    }
}

const modeloYProyecto = (s: Solicitud) => ({modelo:s.modeloCasa?.nombreModelo ?? null, proyecto:s.modeloCasa?.proyecto?.nombre ?? null});
