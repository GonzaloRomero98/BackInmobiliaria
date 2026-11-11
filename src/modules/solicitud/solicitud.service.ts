import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Solicitud } from "./entities/solicitud.entity";
import { In, IsNull, LessThan, Not, Raw, Repository } from "typeorm";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { CrearSolicitudDto } from "./dto/crearSolicitud.dto";
import { ListarSolicitudesDto } from "./dto/listarSolicitudes.dto";
import { AuditoriaService } from "../auditoria/auditoria.service";
import { Reserva } from "../reserva/entities/reserva.entity";
import { ESTADOS_ACTIVOS } from "../reserva/reserva.enum";

const RETENCION_DIAS_POR_DEFECTO = 365;
// Ley 19.628: los datos necesarios para ejecutar un contrato se conservan; el admin usa este texto para responder al titular
const MSJ_RESERVA_ACTIVA = 'La solicitud tiene una reserva activa o una venta; sus datos se conservan para ejecutar el contrato. Si la reserva se anula, se podrá eliminar.';
const VISITA_DIAS_MAXIMOS = 60;

// Los datos vienen de un formulario público: un texto que empieza con =, @, +, - etc. Excel lo ejecutaría
// como fórmula, así que se antepone ' (los celulares tipo "+56 9..." se dejan tal cual).
export function celdaCsv(valor:string):string{
    const seguro = /^[=@\t\r]|^[+-](?![\d\s]+$)/.test(valor) ? `'${valor}` : valor;
    return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

@Injectable()
export class SolicitudService{
    constructor(
        @InjectRepository(Solicitud)
        private readonly solicitudRepository : Repository<Solicitud>,
        @InjectRepository(ModeloCasa)
        private readonly modeloCasaRepostory : Repository<ModeloCasa>,
        private readonly configService: ConfigService,
        private readonly auditoriaService: AuditoriaService,
        @InjectRepository(Reserva)
        private readonly reservaRepository : Repository<Reserva>
    ){}

    async crearSolicitud(crearSolicitudDto:CrearSolicitudDto):Promise<Solicitud>{
        const modeloCasa = await this.modeloCasaRepostory.findOne({where:{id:crearSolicitudDto.id_modelo_casa, activo:true, proyecto:{activo:true}}});

        if(!modeloCasa){
            throw new NotFoundException('El modelo de la casa ingresado no existe');
        }
        const visitaPreferida = this.validarVisita(crearSolicitudDto.visitaPreferida, modeloCasa);

        const solicitud = new Solicitud();
            solicitud.nombre = crearSolicitudDto.nombre;
            solicitud.apellido = crearSolicitudDto.apellido;
            solicitud.correo = crearSolicitudDto.correo;
            solicitud.celular = crearSolicitudDto.celular;
            solicitud.mensaje = crearSolicitudDto.mensaje ?? null;
            solicitud.consentimientoEn = new Date();
            solicitud.modeloCasa = modeloCasa;
            solicitud.visitaPreferida = visitaPreferida;

        return this.solicitudRepository.save(solicitud);
    }

    // Solo si el proyecto tiene sala de ventas, y entre ahora y los próximos VISITA_DIAS_MAXIMOS días
    private validarVisita(visita:string | undefined, modeloCasa:ModeloCasa):Date | null{
        if(!visita) return null;
        if(!modeloCasa.proyecto?.salaDireccion){
            throw new BadRequestException('El proyecto no tiene sala de ventas para agendar una visita');
        }
        const fecha = new Date(visita);
        const ahora = Date.now();
        if(fecha.getTime() <= ahora || fecha.getTime() > ahora + VISITA_DIAS_MAXIMOS * 24 * 60 * 60 * 1000){
            throw new BadRequestException(`La visita debe ser una fecha futura dentro de los próximos ${VISITA_DIAS_MAXIMOS} días`);
        }
        return fecha;
    }

    // Todas, para el CSV
    mostrarSolicitudes(): Promise<Solicitud[]>{
        return this.solicitudRepository.find({relations:{modeloCasa:true, reservas:true},order:{creadoEn:'DESC'}})
    }

    // Bandeja paginada: el filtro va en la consulta para que cada página traiga solo lo que se ve.
    // `pendientes` es el total sin contactar (contador de la pestaña), sin importar el filtro.
    async listarSolicitudes({pagina, limite, filtro}:ListarSolicitudesDto){
        const where = {
            pendientes:{contactado:false},
            contactados:{contactado:true},
            visita:{visitaPreferida:Not(IsNull())},
            todas:{},
        }[filtro];
        const [[solicitudes, total], pendientes] = await Promise.all([
            this.solicitudRepository.findAndCount({
                where, relations:{modeloCasa:true, reservas:true},
                // id desempata las del mismo instante: sin él una fila podría repetirse o saltarse entre páginas
                order:{creadoEn:'DESC', id:'ASC'},
                skip:(pagina - 1) * limite, take:limite,
            }),
            this.solicitudRepository.count({where:{contactado:false}}),
        ]);
        return {solicitudes, total, pendientes, pagina, limite};
    }

    async obtenerSolicitud(id:string):Promise<Solicitud>{
        // Las relaciones eager no se encadenan desde una relación pedida explícitamente: sin esto el proyecto llega sin ciudad
        const solicitud = await this.solicitudRepository.findOne({where:{id}, relations:{modeloCasa:{proyecto:{ciudad:{region:true}}}, reservas:true}});
        if(!solicitud){
            throw new NotFoundException('Solicitud no encontrada');
        }
        return solicitud;
    }

    // CSV con ";" y BOM para que Excel en español lo abra con columnas y tildes correctas.
    // Exportar datos personales queda auditado con el usuario que lo pidió.
    async exportarCsv(usuario:{id:string, correo:string, rol:string}):Promise<string>{
        const solicitudes = await this.mostrarSolicitudes();
        const filas = [
            ['Fecha', 'Nombre', 'Apellido', 'Correo', 'Celular', 'Proyecto', 'Modelo', 'Mensaje', 'Estado', 'Visita preferida'],
            ...solicitudes.map((s) => [
                s.creadoEn.toISOString(), s.nombre, s.apellido, s.correo, s.celular,
                s.modeloCasa?.proyecto?.nombre ?? '', s.modeloCasa?.nombreModelo ?? '', s.mensaje ?? '',
                s.contactado ? 'Contactado' : 'Pendiente',
                s.visitaPreferida?.toISOString() ?? '',
            ]),
        ];

        await this.auditoriaService.registrar({
            accion:'EXPORTAR_SOLICITUDES', exito:true,
            idUsuario:usuario.id, correo:usuario.correo, rol:usuario.rol,
            detalle:{cantidad:solicitudes.length},
        });
        return '﻿' + filas.map((fila) => fila.map(celdaCsv).join(';')).join('\r\n');
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
        if(await this.reservaRepository.exists({where:{solicitud:{id}, estado:In(ESTADOS_ACTIVOS)}})){
            throw new ConflictException(MSJ_RESERVA_ACTIVA);
        }
        const resultado = await this.solicitudRepository.delete({id});
        if(!resultado.affected){
            throw new NotFoundException('Solicitud no encontrada');
        }
    }

    // Comparación exacta sin distinguir mayúsculas (sin LIKE, para que "_" o "%" no actúen como comodines)
    async eliminarPorCorreo(correo:string):Promise<{eliminadas:number}>{
        // Todo o nada: si una de sus solicitudes tiene reserva activa, no se borra ninguna
        const conReserva = await this.reservaRepository.exists({where:{
            estado:In(ESTADOS_ACTIVOS),
            solicitud:{correo:Raw((columna) => `LOWER(${columna}) = LOWER(:correo)`, {correo})},
        }});
        if(conReserva){
            throw new ConflictException(MSJ_RESERVA_ACTIVA);
        }
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
        // Las solicitudes con reserva activa o venta se conservan mientras dure el contrato
        const protegidas = await this.reservaRepository.find({
            where:{estado:In(ESTADOS_ACTIVOS)}, relations:{solicitud:true}, select:{id:true, solicitud:{id:true}},
        });
        const ids = protegidas.map((r) => r.solicitud.id);
        const resultado = await this.solicitudRepository.delete({creadoEn: LessThan(limite), ...(ids.length ? {id:Not(In(ids))} : {})});
        const eliminadas = resultado.affected ?? 0;

        await this.auditoriaService.registrar({
            accion:'RETENCION_SOLICITUDES',
            exito:true,
            detalle:{dias, eliminadas},
        });
        return eliminadas;
    }
}
