import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { Propiedad } from "../../propiedades/entities/propiedad.entity";

@Entity('Invitado')
export class Invitado{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @Column()
    nombre:string;
    
    @Column()
    apellido:string;

    @Column()
    correo:string;

    @Column()
    celular:string;

    @Column('text',{nullable:true})
    mensaje:string;

    @Column({default: false})
    contactado:boolean;

    @CreateDateColumn()
    creado:Date;

    @ManyToOne(() => Propiedad, (propiedad) => propiedad.invitados, {eager:true})
    propiedad: Propiedad;

    
}