import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ModeloCasa } from "../../modeloCasa/entities/modeloCasa.entity";
import { Reserva } from "../../reserva/entities/reserva.entity";
import { EstadoVisita, OrigenSolicitud } from "../solicitud.enum";

@Entity('solicitud')
export class Solicitud{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @Column({length:200})
    nombre:string;

    @Column({length:200})
    apellido:string;

    @Column()
    correo:string;

    @Column({length:20})
    celular:string;

    @Column({name:'mensjae', type:'text', nullable:true})
    mensaje:string | null;

    @Column({default:false})
    contactado:boolean;

    @Column({name:'consentimiento_en', type:'timestamp', nullable:true})
    consentimientoEn: Date | null;

    @Column({name:'visita_preferida', type:'timestamptz', nullable:true})
    visitaPreferida: Date | null;

    // null si no hay visita. Al reagendar queda una nota con la fecha anterior.
    @Column({name:'visita_estado', type:'varchar', length:20, nullable:true})
    visitaEstado: EstadoVisita | null;

    @Column({type:'varchar', length:20, default:OrigenSolicitud.WEB})
    origen: OrigenSolicitud;

    @CreateDateColumn({name:'creado_en'})
    creadoEn: Date;

    @ManyToOne(()=> ModeloCasa,{nullable:false})
    @JoinColumn({name:'id_modelo_casa'})
    modeloCasa: ModeloCasa;

    @OneToMany(()=> Reserva, (reserva) => reserva.solicitud)
    reservas: Reserva[];


}