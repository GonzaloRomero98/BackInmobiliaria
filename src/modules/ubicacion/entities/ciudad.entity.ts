import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm"
import { Region } from "./region.entity";

@Entity('ciudad')
export class Ciudad{
    @PrimaryGeneratedColumn()
    id:number;

    @Column({unique:true})
    nombre:string;

    @OneToMany(()=>Region, (region)=> region.ciudad)
    region: Region[];
}