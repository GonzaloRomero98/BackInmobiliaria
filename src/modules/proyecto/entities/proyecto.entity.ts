import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Ciudad } from "../../ubicacion/entities/ciudad.entity";

@Entity('proyecto')
export class Proyecto{
    @PrimaryGeneratedColumn()
    id:string;

    @Column({length:150})
    nombre:string;

    @Column({type:'text', nullable:false})
    descripcion:string;

    @Column({name:'imagen_portada', type:'varchar', nullable:true})
    imagenPortada: string;

    @Column({default:true})
    activo:boolean;

    @CreateDateColumn({name:'creado_en'})
    creadoEn:Date;

    @ManyToOne(()=> Ciudad,{eager:true, nullable:false})
    @JoinColumn({name:'id_ciudad'})
    ciudad:Ciudad;
}