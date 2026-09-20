import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('rol')
export class Rol {
    @PrimaryGeneratedColumn()
    id:number;

    @Column({unique:true, length:50})
    nombre:string;
}