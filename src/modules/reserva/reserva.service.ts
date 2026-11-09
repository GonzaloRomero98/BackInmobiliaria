import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, EntityManager, In } from "typeorm";
import { Reserva } from "./entities/reserva.entity";
import { Solicitud } from "../solicitud/entities/solicitud.entity";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { calcularEstado } from "../modeloCasa/modelo-casa.enum";
import { CrearReservaDto } from "./dto/crearReserva.dto";
import { ESTADOS_ACTIVOS, EstadoReserva } from "./reserva.enum";

@Injectable()
export class ReservaService{
    constructor(private readonly dataSource:DataSource){}

    async crear(dto:CrearReservaDto):Promise<Reserva>{
        return this.dataSource.transaction(async (manager) => {
            const solicitud = await manager.findOne(Solicitud, {where:{id:dto.id_solicitud}, relations:{modeloCasa:true}});
            if(!solicitud){
                throw new NotFoundException('Solicitud no encontrada');
            }
            if(await manager.exists(Reserva, {where:{solicitud:{id:solicitud.id}, estado:In(ESTADOS_ACTIVOS)}})){
                throw new ConflictException('La solicitud ya tiene una reserva activa');
            }

            const modelo = await this.bloquearModelo(manager, solicitud.modeloCasa.id);
            if(modelo.unidades - modelo.unidadesReservadas - modelo.unidadesVendidas <= 0){
                throw new ConflictException('No quedan unidades de este modelo');
            }

            const reserva = await manager.save(Reserva, {
                solicitud, rut:dto.rut, lote:dto.lote?.trim() || null, estado:EstadoReserva.RESERVADA,
            });
            const reservadas = modelo.unidadesReservadas + 1;
            await manager.update(ModeloCasa, modelo.id, {
                unidadesReservadas:reservadas,
                estado:calcularEstado(modelo.unidades, reservadas, modelo.unidadesVendidas),
            });
            return reserva;
        });
    }

    async cambiarEstado(id:string, estado:EstadoReserva):Promise<Reserva>{
        return this.dataSource.transaction(async (manager) => {
            const reserva = await manager.findOne(Reserva, {where:{id}, relations:{solicitud:{modeloCasa:true}}});
            if(!reserva){
                throw new NotFoundException('Reserva no encontrada');
            }
            if(reserva.estado !== EstadoReserva.RESERVADA || estado === EstadoReserva.RESERVADA){
                throw new BadRequestException('Transición no permitida');
            }

            const modelo = await this.bloquearModelo(manager, reserva.solicitud.modeloCasa.id);
            const reservadas = modelo.unidadesReservadas - 1;
            const vendidas = modelo.unidadesVendidas + (estado === EstadoReserva.VENDIDA ? 1 : 0);
            await manager.update(ModeloCasa, modelo.id, {
                unidadesReservadas:reservadas,
                unidadesVendidas:vendidas,
                estado:calcularEstado(modelo.unidades, reservadas, vendidas),
            });

            reserva.estado = estado;
            return manager.save(Reserva, reserva);
        });
    }

    // Sin relaciones eager: Postgres no permite FOR UPDATE sobre el lado nulo de un LEFT JOIN
    private async bloquearModelo(manager:EntityManager, id:string):Promise<ModeloCasa>{
        const modelo = await manager.findOne(ModeloCasa, {where:{id}, lock:{mode:'pessimistic_write'}, loadEagerRelations:false});
        if(!modelo){
            throw new NotFoundException('No se encontro el modelo de la casa');
        }
        return modelo;
    }
}
