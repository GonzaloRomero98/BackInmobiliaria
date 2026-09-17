import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Ciudad } from "./ciudad.entity";

@Entity('region')
export class Region {
    @PrimaryGeneratedColumn()
    id:number;

    @Column()
    nombre:string;

    @ManyToOne(()=> Ciudad, (ciudad)=> ciudad.region)
    ciudad:Ciudad;
}