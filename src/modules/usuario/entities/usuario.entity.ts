import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Rol } from "../../rol/entities/rol.entity";


// UNIQUE (LOWER(correo)), creado en la migración NombresUnicos. TypeORM no maneja índices sobre expresiones.
@Index('UQ_usuario_correo_lower', {synchronize:false})
@Entity('usuario')
export class Usuario {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    correo: string;

    @Column()
    contrasena: string;

    @Column()
    nombre: string;

    @ManyToOne(()=> Rol,{eager:true, nullable:false})
    @JoinColumn({name:'id_rol'})
    rol:Rol;

    @CreateDateColumn()
    creadoEn: Date;

    @Column({ default: true })
    activo: boolean;

    // Los tokens emitidos antes de esta fecha dejan de servir (ISO 27001 A.5.17).
    @Column({ name: 'contrasena_cambiada_en', type: 'timestamptz', nullable: true })
    contrasenaCambiadaEn: Date | null;

    @Column({ name: 'foto_url', type: 'varchar', length: 500, nullable: true })
    fotoUrl: string | null;

}