import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";
import { ModeloCasa } from "./modeloCasa.entity";

@Entity('galeria_modelo_casa')
export class GaleriaModeloCasa{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @Column({name:'url_imagen',type:'varchar'})
    urlImagen:string;

    @Column({type:'int', default:0})
    orden:number;

    @ManyToOne(()=> ModeloCasa,(modeloCasa) => modeloCasa.fotos,{nullable:false, onDelete:'CASCADE'})
    @JoinColumn({name:'id_modelo_casa'})
    modeloCasa:ModeloCasa;
}