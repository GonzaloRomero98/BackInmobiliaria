import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Solicitud } from "./solicitud.entity";
import { Usuario } from "../../usuario/entities/usuario.entity";

// Seguimiento de un cliente ("llamé, no contestó"). No se editan ni se borran: para corregir se agrega otra.
// Se borran solo junto con la solicitud (retención o supresión), por la FK en cascada.
@Entity('nota_solicitud')
export class NotaSolicitud{
    @PrimaryGeneratedColumn('uuid', {primaryKeyConstraintName:'PK_nota_solicitud'})
    id:string;

    @Column({type:'text'})
    texto:string;

    @Index('IDX_nota_solicitud_solicitud')
    @ManyToOne(()=> Solicitud, {nullable:false, onDelete:'CASCADE'})
    @JoinColumn({name:'id_solicitud', foreignKeyConstraintName:'FK_nota_solicitud_solicitud'})
    solicitud:Solicitud;

    // Quien la escribió (los usuarios se desactivan, no se borran; SET NULL por si acaso)
    @ManyToOne(()=> Usuario, {nullable:true, onDelete:'SET NULL'})
    @JoinColumn({name:'id_usuario', foreignKeyConstraintName:'FK_nota_solicitud_usuario'})
    usuario:Usuario | null;

    @CreateDateColumn({name:'creado_en'})
    creadoEn:Date;
}
