import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum RolUsuario {
    ADMIN = "ADMIN",
    SECRETARIA = "SECRETARIA",
}

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

    @Column({
        type: 'enum',
        enum: RolUsuario,
        default: RolUsuario.ADMIN,
    })
    rol: RolUsuario;

    @CreateDateColumn()
    creadoEn: Date;

    @Column({ default: true })
    activo: boolean;

}