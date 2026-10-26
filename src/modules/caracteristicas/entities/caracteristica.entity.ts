import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('caracteristica')
export class Caracteristica{
    @PrimaryGeneratedColumn()
    id:number;

    @Column({unique:true, length:150})
    nombre:string;
}