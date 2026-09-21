import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Proyecto } from "../../proyecto/entities/proyecto.entity";

@Entity('modelo_casa')
export class ModeloCasa{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @Column({name:'nombre_modelo', length:150})
    nombreModelo:string;

    @Column({name:'tipo_operacion', type:'varchar', length:20})
    tipoOperacion:string;

    @Column({type:'int'})
    dormitorios:number;

    @Column({type:'int'})
    banos:number;
    
    @Column({type:'int',default:0})
    estacionamientos:number;

    @Column({default:false})
    mascotas: boolean;

    @Column({name:'superficie_construida', type:'decimal'})
    superficieConstruida:number;

     @Column({name:'superficie_terreno', type:'decimal'})
    superficieTerreno:number;

    @Column({type:'decimal', precision:12, scale:4})
    precio:number;

    @Column({type:'varchar', length:3})
    moneda:string;

    @Column({name:'gastos_comunes', type:'boolean'})
    gastosComunes:boolean;

    @Column({name:'modelo_3d_url', type:'varchar', nullable:false})
    modelo3dUrl:string;

    @Column({name:'img_principal', type:'varchar',nullable:false})
    imgPrincipal:string;

    @Column({default:true})
    activo:boolean;

    @CreateDateColumn()
    creadoEn: Date;

    @ManyToOne(()=>Proyecto,{eager:true, nullable:false})
    @JoinColumn({name:'id_proyecto'})
    proyecto:Proyecto
}