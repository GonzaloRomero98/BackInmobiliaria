import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity('auditoria')
export class Auditoria{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @Index()
    @CreateDateColumn({name:'fecha'})
    fecha:Date;

    @Column({length:100})
    accion:string;

    @Column({type:'varchar', length:10, nullable:true})
    metodo:string | null;

    @Column({type:'varchar', length:300, nullable:true})
    ruta:string | null;

    @Column({type:'int', nullable:true})
    estado:number | null;

    @Column()
    exito:boolean;

    @Column({name:'id_usuario', type:'uuid', nullable:true})
    idUsuario:string | null;

    @Column({type:'varchar', nullable:true})
    correo:string | null;

    @Column({type:'varchar', length:50, nullable:true})
    rol:string | null;

    @Column({type:'varchar', length:64, nullable:true})
    ip:string | null;

    @Column({type:'jsonb', nullable:true})
    detalle:Record<string, unknown> | null;
}
