import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Solicitud } from "../../solicitud/entities/solicitud.entity";
import { EstadoReserva } from "../reserva.enum";

@Entity('reserva')
export class Reserva{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    // Sin cascada: la BD no deja borrar una solicitud que tenga reservas. SolicitudService borra antes las anuladas,
    // así que si el borrado falla es porque hay una reserva activa o una venta (ver borrarSolicitudes).
    @ManyToOne(()=> Solicitud, (solicitud) => solicitud.reservas, {nullable:false, onDelete:'NO ACTION'})
    @JoinColumn({name:'id_solicitud'})
    solicitud:Solicitud;

    @Column({type:'varchar', length:12})
    rut:string;

    @Column({type:'varchar', length:50, nullable:true})
    lote:string | null;

    @Column({type:'varchar', length:20, default:EstadoReserva.RESERVADA})
    estado:string;

    @CreateDateColumn({name:'creado_en'})
    creadoEn:Date;

    @UpdateDateColumn({name:'actualizado_en'})
    actualizadoEn:Date;
}
