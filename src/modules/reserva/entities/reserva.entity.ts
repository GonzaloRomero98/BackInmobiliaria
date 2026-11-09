import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Solicitud } from "../../solicitud/entities/solicitud.entity";
import { EstadoReserva } from "../reserva.enum";

// El comprador (nombre y contacto) sale de la solicitud; el RUT se pide al reservar en la sala de ventas
@Entity('reserva')
export class Reserva{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    // CASCADE: solo se llega a borrar una solicitud cuya reserva está anulada (SolicitudService lo impide en las demás)
    @ManyToOne(()=> Solicitud, (solicitud) => solicitud.reservas, {nullable:false, onDelete:'CASCADE'})
    @JoinColumn({name:'id_solicitud'})
    solicitud:Solicitud;

    // Normalizado: 12345678-9
    @Column({type:'varchar', length:12})
    rut:string;

    // Texto libre, ej: "Lote 12"
    @Column({type:'varchar', length:50, nullable:true})
    lote:string | null;

    @Column({type:'varchar', length:20, default:EstadoReserva.RESERVADA})
    estado:string;

    @CreateDateColumn({name:'creado_en'})
    creadoEn:Date;

    @UpdateDateColumn({name:'actualizado_en'})
    actualizadoEn:Date;
}
