import { CreateDateColumn, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { ModeloCasa } from "../../modeloCasa/entities/modeloCasa.entity";

export enum TipoEventoModelo{
    QR_ESCANEADO = 'QR_ESCANEADO',
    AR_INICIADA = 'AR_INICIADA',
}

// Uso anónimo de la experiencia 3D/RA (sin datos personales): cuántas veces se escanea el QR o se abre la RA
@Entity('evento_modelo')
export class EventoModelo{
    @PrimaryGeneratedColumn('uuid', {primaryKeyConstraintName:'PK_evento_modelo'})
    id:string;

    @Column({type:'varchar', length:20})
    tipo:TipoEventoModelo;

    @ManyToOne(()=> ModeloCasa, {nullable:false, onDelete:'CASCADE'})
    @JoinColumn({name:'id_modelo_casa', foreignKeyConstraintName:'FK_evento_modelo_modelo'})
    modeloCasa:ModeloCasa;

    @Index('IDX_evento_modelo_creado')
    @CreateDateColumn({name:'creado_en'})
    creadoEn:Date;
}
