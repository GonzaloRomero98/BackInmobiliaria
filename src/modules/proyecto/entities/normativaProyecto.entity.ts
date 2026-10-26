import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Proyecto } from "./proyecto.entity";
import { decimalANumero } from "../../../database/transformadores";

// Ficha de normativa urbana del terreno del proyecto, según el instrumento de planificación vigente
// (Plan Regulador Comunal y, si aplica, Intercomunal). Es referencial: la fuente oficial es el
// Certificado de Informaciones Previas (CIP) de la Dirección de Obras Municipales.
@Entity('normativa_proyecto')
export class NormativaProyecto{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @OneToOne(()=> Proyecto, {nullable:false, onDelete:'CASCADE'})
    @JoinColumn({name:'id_proyecto'})
    proyecto:Proyecto;

    // Ej: "Plan Regulador Comunal de Talca (2019)"
    @Column({length:200})
    instrumento:string;

    // Ej: "ZH-2"
    @Column({length:50})
    zona:string;

    @Column({name:'usos_permitidos', type:'text'})
    usosPermitidos:string;

    @Column({name:'altura_maxima_metros', type:'decimal', precision:6, scale:2, nullable:true, transformer:decimalANumero})
    alturaMaximaMetros:number | null;

    @Column({name:'altura_maxima_pisos', type:'int', nullable:true})
    alturaMaximaPisos:number | null;

    // Habitantes por hectárea
    @Column({name:'densidad_maxima', type:'int', nullable:true})
    densidadMaxima:number | null;

    @Column({name:'coef_constructibilidad', type:'decimal', precision:5, scale:2, nullable:true, transformer:decimalANumero})
    coefConstructibilidad:number | null;

    // Fracción del terreno que se puede ocupar con construcción (0 a 1)
    @Column({name:'coef_ocupacion_suelo', type:'decimal', precision:4, scale:2, nullable:true, transformer:decimalANumero})
    coefOcupacionSuelo:number | null;

    @Column({type:'text', array:true, default:'{}'})
    riesgos:string[];

    @Column({name:'url_ordenanza', type:'varchar', nullable:true})
    urlOrdenanza:string | null;

    @Column({name:'fecha_consulta', type:'date'})
    fechaConsulta:string;

    @Column({type:'text', nullable:true})
    observaciones:string | null;

    @UpdateDateColumn({name:'actualizado_en'})
    actualizadoEn:Date;
}
