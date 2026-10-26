import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { ModeloCasa } from "../../modeloCasa/entities/modeloCasa.entity";

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

    @CreateDateColumn({name:'creado_en'})
    creadoEn: Date;

    @ManyToOne(()=> ModeloCasa,{nullable:false})
    @JoinColumn({name:'id_modelo_casa'})
    modeloCasa: ModeloCasa;


}