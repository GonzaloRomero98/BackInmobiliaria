import { Column, CreateDateColumn, Entity, Generated, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Solicitud } from "./solicitud.entity";
import { Usuario } from "../../usuario/entities/usuario.entity";

// Valores guardados al emitir, para que una reimpresión salga igual aunque cambie el precio o la UF.
export interface DatosCotizacion{
    nombreModelo:string;
    precio:number;
    moneda:string;
    tipoOperacion:string;
    uf:{valor:number, fecha:string} | null;
    pie:number;
    tasa:number;
    plazo:number;
    validez:number;
    nota:string;
}

@Entity('cotizacion')
export class Cotizacion{
    @PrimaryGeneratedColumn('uuid', {primaryKeyConstraintName:'PK_cotizacion'})
    id:string;

    @Index('UQ_cotizacion_folio', {unique:true})
    @Column()
    @Generated('increment')
    folio:number;

    @Column({type:'jsonb'})
    datos:DatosCotizacion;

    @Index('IDX_cotizacion_solicitud')
    @ManyToOne(()=> Solicitud, {nullable:false, onDelete:'CASCADE'})
    @JoinColumn({name:'id_solicitud', foreignKeyConstraintName:'FK_cotizacion_solicitud'})
    solicitud:Solicitud;

    @ManyToOne(()=> Usuario, {nullable:true, onDelete:'SET NULL'})
    @JoinColumn({name:'id_usuario', foreignKeyConstraintName:'FK_cotizacion_usuario'})
    usuario:Usuario | null;

    @CreateDateColumn({name:'creado_en'})
    creadoEn:Date;
}
