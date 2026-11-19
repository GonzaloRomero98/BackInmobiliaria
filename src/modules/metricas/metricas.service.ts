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

const HORA_MS = 60 * 60 * 1000;

// "Hoy", "esta semana" y "este mes" se cuentan en hora de Chile, no en la del servidor (UTC en EC2).
// No se cambia la variable TZ del proceso: las columnas timestamp sin zona (creado_en) se leerían corridas.
const FECHA_CHILE = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Santiago', year:'numeric', month:'2-digit', day:'2-digit'});

// "AAAA-MM-DD" del día en Chile.
const claveDia = (fecha: Date) => FECHA_CHILE.format(fecha);

function fechaChile(fecha: Date){
    const [anio, mes, dia] = claveDia(fecha).split('-').map(Number);
    return {anio, mes, dia};
}

// Primer instante de ese día en Chile. Acepta días fuera de rango (0, negativos), como Date.UTC.
// Chile está entre UTC-3 y UTC-4 y cambia la hora a medianoche, así que se busca la primera hora UTC de esa fecha
// que en Chile ya es ese día: las 00:00, o la 01:00 el día en que se adelanta el reloj.
function inicioDiaChile(anio: number, mes: number, dia: number): Date {
    const base = Date.UTC(anio, mes - 1, dia);
    const clave = new Date(base).toISOString().slice(0, 10);
    for (let hora = 0; hora < 24; hora++) {
        const instante = new Date(base + hora * HORA_MS);
        if (claveDia(instante) === clave) return instante;
    }
    throw new Error(`No se encontró el inicio del día ${clave} en Chile`);
}

export function inicioDia(fecha: Date): Date {
    const {anio, mes, dia} = fechaChile(fecha);
    return inicioDiaChile(anio, mes, dia);
}

// Lunes a las 00:00 (Chile) de la semana de la fecha, o de `semanasAtras` semanas antes.
export function inicioSemana(fecha: Date, semanasAtras = 0): Date {
    const {anio, mes, dia} = fechaChile(fecha);
    const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
    return inicioDiaChile(anio, mes, dia - (diaSemana + 6) % 7 - 7 * semanasAtras);
}

export function inicioMes(fecha: Date): Date {
    const {anio, mes} = fechaChile(fecha);
    return inicioDiaChile(anio, mes, 1);
}

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
        const mes = inicioMes(ahora);
        const primeraSemana = inicioSemana(ahora, SEMANAS_GRAFICO - 1);

        const [total, pendientes, ultimos30Dias, previos30Dias, publicados, borradores, casas, proyectosActivos,
            reservasMes, ventasMes, visitas, recientes, masSolicitados, escaneosQr, sesionesAr] = await Promise.all([
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
            this.reservaRepository.count({where:{creadoEn:MoreThanOrEqual(mes)}}),
            this.reservaRepository.count({where:{estado:EstadoReserva.VENDIDA, actualizadoEn:MoreThanOrEqual(mes)}}),
            this.proximasVisitas(ahora, 5),
            // Las semanas se arman aquí y no con date_trunc, que usaría la zona de la BD.
            // Mejora pendiente: trae una fila por solicitud de las últimas 8 semanas; con decenas de miles conviene agrupar en SQL.
            this.solicitudRepository.find({select:{id:true, creadoEn:true}, where:{creadoEn:MoreThanOrEqual(primeraSemana)}}),
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

        const conteoSemana = new Map<string, number>();
        for(const {creadoEn} of recientes){
            const semana = claveDia(inicioSemana(creadoEn));
            conteoSemana.set(semana, (conteoSemana.get(semana) ?? 0) + 1);
        }
        const semanas = Array.from({length:SEMANAS_GRAFICO}, (_, i) => {
            const semana = claveDia(inicioSemana(ahora, SEMANAS_GRAFICO - 1 - i));
            return {semana, solicitudes:conteoSemana.get(semana) ?? 0};
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
        const [[porContactar, pendientes], nuevasHoy, nuevasSemana, visitas, [reservas, reservasEnCurso], ventasMes] = await Promise.all([
            this.solicitudRepository.findAndCount({
                where:{contactado:false}, relations:{modeloCasa:{proyecto:true}}, order:{creadoEn:'ASC'}, take:5,
            }),
            this.solicitudRepository.count({where:{creadoEn:MoreThanOrEqual(inicioDia(ahora))}}),
            this.solicitudRepository.count({where:{creadoEn:MoreThanOrEqual(inicioSemana(ahora))}}),
            this.proximasVisitas(ahora, 8),
            this.reservaRepository.findAndCount({
                where:{estado:EstadoReserva.RESERVADA}, relations:{solicitud:{modeloCasa:{proyecto:true}}}, order:{creadoEn:'ASC'}, take:5,
            }),
            this.reservaRepository.count({where:{estado:EstadoReserva.VENDIDA, actualizadoEn:MoreThanOrEqual(inicioMes(ahora))}}),
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
