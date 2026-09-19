import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm"
import { Region } from "./region.entity";

@Entity('ciudad')
export class Ciudad{
    @PrimaryGeneratedColumn()
    id:number;

    @Column({unique:true})
    nombre:string;

    @ManyToOne(()=>Region, (region)=> region.ciudad,{eager:true, nullable:false})
    @JoinColumn({name:'id_region'})
    region: Region;
}