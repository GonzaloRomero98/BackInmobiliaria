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

    @Column({type:'decimal', precision:9, scale:6, nullable:true, transformer:decimalANumero})
    latitud: number | null;

    @Column({type:'decimal', precision:9, scale:6, nullable:true, transformer:decimalANumero})
    longitud: number | null;

    // Servicios cercanos calculados con OpenStreetMap al guardar la ubicación. Se piden aparte en /entorno.
    @Column({type:'jsonb', nullable:true, select:false})
    entorno: Entorno | null;

    @Column({name:'entorno_actualizado_en', type:'timestamp', nullable:true, select:false})
    entornoActualizadoEn: Date | null;

    @Column({type:'varchar', length:20, nullable:true})
    etapa: string | null;

    // pg entrega las columnas date como texto 'YYYY-MM-DD'.
    @Column({name:'fecha_entrega', type:'date', nullable:true})
    fechaEntrega: string | null;

    @Column({name:'sala_direccion', type:'varchar', length:200, nullable:true})
    salaDireccion: string | null;

    @Column({name:'sala_horario', type:'varchar', length:150, nullable:true})
    salaHorario: string | null;

    @Column({name:'sala_telefono', type:'varchar', length:20, nullable:true})
    salaTelefono: string | null;

    @Column({name:'sala_latitud', type:'decimal', precision:9, scale:6, nullable:true, transformer:decimalANumero})
    salaLatitud: number | null;

    @Column({name:'sala_longitud', type:'decimal', precision:9, scale:6, nullable:true, transformer:decimalANumero})
    salaLongitud: number | null;

    @Column({default:true})
    activo:boolean;

    @CreateDateColumn({name:'creado_en'})
    creadoEn:Date;

    @ManyToOne(()=> Ciudad,{eager:true, nullable:false})
    @JoinColumn({name:'id_ciudad'})
    ciudad:Ciudad;
}