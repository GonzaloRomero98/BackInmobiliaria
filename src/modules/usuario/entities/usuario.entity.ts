import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Rol } from "../../rol/entities/rol.entity";


@Entity('usuario')
export class Usuario {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    correo: string;

    @Column()
    contrasena: string;

    @Column({unique:true,length:50})
    nombre: string;

    @ManyToOne(()=> Rol,{eager:true, nullable:false})
    @JoinColumn({name:'id_rol'})
    rol:Rol;

    @CreateDateColumn()
    creadoEn: Date;

    @Column({ default: true })
    activo: boolean;

}