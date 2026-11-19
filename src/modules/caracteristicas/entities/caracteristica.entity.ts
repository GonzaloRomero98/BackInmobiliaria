import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// UNIQUE (LOWER(nombre)), creado en la migración NombresUnicos. TypeORM no maneja índices sobre expresiones.
@Index('UQ_caracteristica_nombre_lower', {synchronize:false})
@Entity('caracteristica')
export class Caracteristica{
    @PrimaryGeneratedColumn()
    id:number;

    @Column({unique:true, length:150})
    nombre:string;
}