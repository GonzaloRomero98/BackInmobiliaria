import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Solicitud } from "./entities/solicitud.entity";
import { FindOptionsWhere, In, IsNull, LessThan, Not, Raw, Repository } from "typeorm";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { CrearSolicitudDto } from "./dto/crearSolicitud.dto";
import { ListarSolicitudesDto } from "./dto/listarSolicitudes.dto";
import { AuditoriaService } from "../auditoria/auditoria.service";
import { Reserva } from "../reserva/entities/reserva.entity";
import { ESTADOS_ACTIVOS, EstadoReserva } from "../reserva/reserva.enum";
import { CorregirDatosSolicitudDto } from "./dto/corregirDatosSolicitud.dto";
import { escaparLike } from "../auditoria/auditoria.service";
import { NotaSolicitud } from "./entities/notaSolicitud.entity";
import { Cotizacion, DatosCotizacion } from "./entities/cotizacion.entity";
import { CrearSolicitudPanelDto } from "./dto/crearSolicitudPanel.dto";
import { ActualizarVisitaDto } from "./dto/actualizarVisita.dto";
import { CrearCotizacionDto } from "./dto/crearCotizacion.dto";
import { ETIQUETA_ORIGEN, ETIQUETA_VISITA, EstadoVisita, OrigenSolicitud } from "./solicitud.enum";

const fechaHoraChile = (fecha: Date) => fecha.toLocaleString('es-CL', {
    timeZone:'America/Santiago', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hourCycle:'h23',
});

const RETENCION_DIAS_POR_DEFECTO = 365;
// Ley 19.628: los datos necesarios para cumplir un contrato se conservan.
const MSJ_RESERVA_ACTIVA = 'La solicitud tiene una reserva activa o una venta; sus datos se conservan para ejecutar el contrato. Si la reserva se anula, se podrá eliminar.';
const VISITA_DIAS_MAXIMOS = 60;
const CAMPOS_CONTACTO = ['nombre', 'apellido', 'correo', 'celular'] as const;
const LISTA = new Intl.ListFormat('es', {type:'conjunction'});

// Excel ejecuta como fórmula un texto que empieza con =, @, + o -, así que se le antepone una comilla.
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
        private readonly reservaRepository : Repository<Reserva>,
        @InjectRepository(NotaSolicitud)
        private readonly notaRepository : Repository<NotaSolicitud>,
        @InjectRepository(Cotizacion)
        private readonly cotizacionRepository : Repository<Cotizacion>
    ){}

    crearSolicitud(crearSolicitudDto:CrearSolicitudDto):Promise<Solicitud>{
        return this.guardarNueva(crearSolicitudDto, OrigenSolicitud.WEB);
    }

    // Desde el panel la secretaria ya habla con el cliente, por eso queda contactado y la visita confirmada.
    crearDesdePanel(dto:CrearSolicitudPanelDto):Promise<Solicitud>{
        return this.guardarNueva(dto, dto.origen);
    }

    private async guardarNueva(crearSolicitudDto:Omit<CrearSolicitudDto, 'aceptaPrivacidad'>, origen:OrigenSolicitud):Promise<Solicitud>{
        const desdePanel = origen !== OrigenSolicitud.WEB;
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
            solicitud.visitaEstado = visitaPreferida ? (desdePanel ? EstadoVisita.CONFIRMADA : EstadoVisita.POR_CONFIRMAR) : null;
            solicitud.origen = origen;
            solicitud.contactado = desdePanel;

        return this.solicitudRepository.save(solicitud);
    }

    // Solo si el proyecto tiene sala de ventas, y entre ahora y VISITA_DIAS_MAXIMOS días.
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

    async resumen():Promise<{pendientes:number}>{
        return {pendientes: await this.solicitudRepository.count({where:{contactado:false}})};
    }

    mostrarSolicitudes(): Promise<Solicitud[]>{
        return this.solicitudRepository.find({relations:{modeloCasa:true, reservas:true},order:{creadoEn:'DESC'}})
    }

    async listarSolicitudes({pagina, limite, filtro, buscar}:ListarSolicitudesDto){
        const terminos = buscar ? buscar.split(/\s+/).filter(Boolean).slice(0, 5) : [];
        const coincide = terminos.length === 0 ? {} : {
            id: Raw((columna) => `${columna} IN (SELECT s.id FROM solicitud s WHERE ${
                terminos.map((_, i) => `concat_ws(' ', s.nombre, s.apellido, s.correo, s.celular) ILIKE :termino${i}`).join(' AND ')})`,
                Object.fromEntries(terminos.map((t, i) => [`termino${i}`, `%${escaparLike(t)}%`]))),
        };
        const where = {
            ...{
                pendientes:{contactado:false},
                contactados:{contactado:true},
                visita:{visitaPreferida:Not(IsNull())},
                todas:{},
            }[filtro],
            ...coincide,
        };
        const [[solicitudes, total], pendientes] = await Promise.all([
            this.solicitudRepository.findAndCount({
                where, relations:{modeloCasa:true, reservas:true},
                // id desempata las solicitudes del mismo instante; sin él una fila podría repetirse entre páginas.
                order:{creadoEn:'DESC', id:'ASC'},
                skip:(pagina - 1) * limite, take:limite,
            }),
            this.solicitudRepository.count({where:{contactado:false}}),
        ]);
        return {solicitudes, total, pendientes, pagina, limite};
    }

    async obtenerSolicitud(id:string){
        // Las relaciones eager no se cargan dentro de una relación pedida a mano, por eso se pide la ciudad.
        const solicitud = await this.solicitudRepository.findOne({where:{id}, relations:{modeloCasa:{proyecto:{ciudad:{region:true}}}, reservas:true}});
        if(!solicitud){
            throw new NotFoundException('Solicitud no encontrada');
        }
        const autor = {relations:{usuario:true}, loadEagerRelations:false} as const;
        const [notas, cotizaciones] = await Promise.all([
            this.notaRepository.find({
                where:{solicitud:{id}}, ...autor, order:{creadoEn:'DESC'},
                select:{id:true, texto:true, creadoEn:true, usuario:{id:true, nombre:true}},
            }),
            this.cotizacionRepository.find({
                where:{solicitud:{id}}, ...autor, order:{folio:'DESC'},
                select:{id:true, folio:true, datos:true, creadoEn:true, usuario:{id:true, nombre:true}},
            }),
        ]);
        return {...solicitud, notas, cotizaciones};
    }

    async agregarNota(id:string, texto:string, idUsuario:string):Promise<NotaSolicitud>{
        if(!await this.solicitudRepository.exists({where:{id}})){
            throw new NotFoundException('Solicitud no encontrada');
        }
        return this.notaRepository.save(this.notaRepository.create({texto, solicitud:{id}, usuario:{id:idUsuario}}));
    }

    async actualizarVisita(id:string, {fecha, estado}:ActualizarVisitaDto, idUsuario:string):Promise<Solicitud>{
        if(!fecha && !estado){
            throw new BadRequestException('Indica una fecha o un estado para la visita');
        }
        const solicitud = await this.solicitudRepository.findOne({where:{id}, relations:{modeloCasa:{proyecto:true}}});
        if(!solicitud){
            throw new NotFoundException('Solicitud no encontrada');
        }
        let nota: string | null = null;
        if(fecha){
            const nueva = this.validarVisita(fecha, solicitud.modeloCasa)!;
            const anterior = solicitud.visitaPreferida;
            nota = anterior
                ? `Visita reagendada: del ${fechaHoraChile(anterior)} al ${fechaHoraChile(nueva)}.`
                : `Visita agendada para el ${fechaHoraChile(nueva)}.`;
            solicitud.visitaPreferida = nueva;
            solicitud.visitaEstado = estado ?? EstadoVisita.CONFIRMADA;
        }else{
            if(!solicitud.visitaPreferida){
                throw new BadRequestException('La solicitud no tiene una visita agendada');
            }
            solicitud.visitaEstado = estado!;
        }
        const asistencia = solicitud.visitaEstado === EstadoVisita.ASISTIO || solicitud.visitaEstado === EstadoVisita.NO_ASISTIO;
        if(asistencia && solicitud.visitaPreferida!.getTime() > Date.now()){
            throw new BadRequestException('La asistencia se marca después de la hora de la visita');
        }
        if(solicitud.visitaEstado !== EstadoVisita.POR_CONFIRMAR){
            solicitud.contactado = true;
        }
        return this.solicitudRepository.manager.transaction(async (manager) => {
            const guardada = await manager.save(solicitud);
            if(nota){
                await manager.save(manager.create(NotaSolicitud, {texto:nota, solicitud:{id}, usuario:{id:idUsuario}}));
            }
            return guardada;
        });
    }

    // Guarda el precio y el modelo leídos aquí junto con las condiciones elegidas. El folio lo asigna la BD.
    async emitirCotizacion(id:string, dto:CrearCotizacionDto, idUsuario:string):Promise<Cotizacion>{
        const solicitud = await this.solicitudRepository.findOne({where:{id}, relations:{modeloCasa:true}});
        if(!solicitud){
            throw new NotFoundException('Solicitud no encontrada');
        }
        const modelo = solicitud.modeloCasa;
        const datos: DatosCotizacion = {
            nombreModelo:modelo.nombreModelo, precio:Number(modelo.precio), moneda:modelo.moneda, tipoOperacion:modelo.tipoOperacion,
            uf:dto.uf ? {valor:dto.uf.valor, fecha:dto.uf.fecha} : null,
            pie:dto.pie, tasa:dto.tasa, plazo:dto.plazo, validez:dto.validez, nota:dto.nota?.trim() ?? '',
        };
        return this.cotizacionRepository.save(this.cotizacionRepository.create({datos, solicitud:{id}, usuario:{id:idUsuario}}));
    }

    // CSV con ";" y BOM para que Excel en español lo abra con columnas y tildes correctas. La exportación queda auditada.
    async exportarCsv(usuario:{id:string, correo:string, rol:string}):Promise<string>{
        const solicitudes = await this.mostrarSolicitudes();
        const filas = [
            ['Fecha', 'Nombre', 'Apellido', 'Correo', 'Celular', 'Proyecto', 'Modelo', 'Mensaje', 'Estado', 'Visita preferida', 'Estado visita', 'Origen'],
            ...solicitudes.map((s) => [
                s.creadoEn.toISOString(), s.nombre, s.apellido, s.correo, s.celular,
                s.modeloCasa?.proyecto?.nombre ?? '', s.modeloCasa?.nombreModelo ?? '', s.mensaje ?? '',
                s.contactado ? 'Contactado' : 'Pendiente',
                s.visitaPreferida?.toISOString() ?? '',
                s.visitaEstado ? ETIQUETA_VISITA[s.visitaEstado] : '',
                ETIQUETA_ORIGEN[s.origen] ?? '',
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

    // Derecho de rectificación (Ley 21.719). La nota dice qué campos cambiaron, pero no el valor anterior,
    // para que el dato erróneo no quede copiado en el seguimiento.
    async corregirDatos(id:string, dto:CorregirDatosSolicitudDto, idUsuario:string):Promise<Solicitud>{
        const solicitud = await this.solicitudRepository.findOne({where:{id}});
        if(!solicitud){
            throw new NotFoundException('Solicitud no encontrada');
        }
        const corregidos = CAMPOS_CONTACTO.filter((campo) => dto[campo] != null && dto[campo] !== solicitud[campo]);
        if(corregidos.length === 0) return solicitud;
        for(const campo of corregidos) solicitud[campo] = dto[campo]!;

        return this.solicitudRepository.manager.transaction(async (manager) => {
            const guardada = await manager.save(solicitud);
            await manager.save(manager.create(NotaSolicitud, {
                texto:`Se corrigieron los datos de contacto: ${LISTA.format(corregidos)}.`, solicitud:{id}, usuario:{id:idUsuario},
            }));
            return guardada;
        });
    }

    async eliminarSolicitud(id:string):Promise<void>{
        if(await this.borrarSolicitudes({id}) === 0){
            throw new NotFoundException('Solicitud no encontrada');
        }
    }

    // Si una de sus solicitudes tiene una reserva activa, no se borra ninguna.
    async eliminarPorCorreo(correo:string):Promise<{eliminadas:number}>{
        return {eliminadas: await this.borrarSolicitudes({correo:Raw((columna) => `LOWER(${columna}) = LOWER(:correo)`, {correo})})};
    }

    // Borra las solicitudes junto con sus reservas anuladas, en una transacción.
    // La BD no deja borrar una solicitud que tenga otra reserva (FK sin cascada), así que si hay una reserva activa o una venta,
    // incluso una creada justo ahora por otra persona, falla todo y se responde 409 sin perder la reserva.
    private async borrarSolicitudes(where:FindOptionsWhere<Solicitud>):Promise<number>{
        try{
            return await this.solicitudRepository.manager.transaction(async (manager) => {
                const ids = (await manager.find(Solicitud, {where, select:{id:true}, loadEagerRelations:false})).map((s) => s.id);
                if(ids.length === 0) return 0;
                await manager.createQueryBuilder().delete().from(Reserva)
                    .where('id_solicitud IN (:...ids) AND estado = :anulada', {ids, anulada:EstadoReserva.ANULADA})
                    .execute();
                return (await manager.delete(Solicitud, {id:In(ids)})).affected ?? 0;
            });
        }catch(error){
            if((error as {constraint?:string}).constraint === 'FK_reserva_solicitud'){
                throw new ConflictException(MSJ_RESERVA_ACTIVA);
            }
            throw error;
        }
    }

    // Retención: los datos personales de las solicitudes se borran al cumplir el plazo.
    @Cron(CronExpression.EVERY_DAY_AT_3AM, {timeZone:'America/Santiago'})
    async eliminarVencidas():Promise<number>{
        const dias = Number(this.configService.get('SOLICITUD_RETENCION_DIAS') ?? RETENCION_DIAS_POR_DEFECTO);
        const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
        // Las solicitudes con reserva activa o venta se conservan mientras dure el contrato.
        const protegidas = await this.reservaRepository.find({
            where:{estado:In(ESTADOS_ACTIVOS)}, relations:{solicitud:true}, select:{id:true, solicitud:{id:true}},
        });
        // Si alguien reserva una de estas solicitudes justo ahora, falla todo y se reintenta mañana.
        const ids = protegidas.map((r) => r.solicitud.id);
        const eliminadas = await this.borrarSolicitudes({creadoEn: LessThan(limite), ...(ids.length ? {id:Not(In(ids))} : {})});

        await this.auditoriaService.registrar({
            accion:'RETENCION_SOLICITUDES',
            exito:true,
            detalle:{dias, eliminadas},
        });
        return eliminadas;
    }
}
