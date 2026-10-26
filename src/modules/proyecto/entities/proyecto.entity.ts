import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Ciudad } from "../../ubicacion/entities/ciudad.entity";
import { decimalANumero } from "../../../database/transformadores";
import type { Entorno } from "../entorno.service";

@Entity('proyecto')
export class Proyecto{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @Column({length:150})
    nombre:string;

    @Column({type:'text', nullable:false})
    descripcion:string;

    @Column({name:'imagen_portada', type:'varchar', nullable:true})
    imagenPortada: string;

    @Column({type:'varchar', length:200, nullable:true})
    direccion: string | null;

    // Coordenadas WGS84 para el mapa y el entorno (servicios cercanos)
    @Column({type:'decimal', precision:9, scale:6, nullable:true, transformer:decimalANumero})
    latitud: number | null;

    @Column({type:'decimal', precision:9, scale:6, nullable:true, transformer:decimalANumero})
    longitud: number | null;

    // Servicios cercanos (OpenStreetMap) calculados al guardar la ubicación; se piden aparte en /entorno
    @Column({type:'jsonb', nullable:true, select:false})
    entorno: Entorno | null;

    @Column({name:'entorno_actualizado_en', type:'timestamp', nullable:true, select:false})
    entornoActualizadoEn: Date | null;

    @Column({default:true})
    activo:boolean;

    @CreateDateColumn({name:'creado_en'})
    creadoEn:Date;

    @ManyToOne(()=> Ciudad,{eager:true, nullable:false})
    @JoinColumn({name:'id_ciudad'})
    ciudad:Ciudad;
}