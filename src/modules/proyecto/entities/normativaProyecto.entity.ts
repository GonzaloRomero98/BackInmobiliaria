import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Proyecto } from "./proyecto.entity";
import { decimalANumero } from "../../../database/transformadores";

// Normativa urbana del terreno según el plan regulador.
// Es referencial: la fuente oficial es el Certificado de Informaciones Previas (CIP) de la DOM.
@Entity('normativa_proyecto')
export class NormativaProyecto{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @OneToOne(()=> Proyecto, {nullable:false, onDelete:'CASCADE'})
    @JoinColumn({name:'id_proyecto'})
    proyecto:Proyecto;

    @Column({length:200})
    instrumento:string;

    @Column({length:50})
    zona:string;

    @Column({name:'usos_permitidos', type:'text'})
    usosPermitidos:string;

    @Column({name:'altura_maxima_metros', type:'decimal', precision:6, scale:2, nullable:true, transformer:decimalANumero})
    alturaMaximaMetros:number | null;

    @Column({name:'altura_maxima_pisos', type:'int', nullable:true})
    alturaMaximaPisos:number | null;

    @Column({name:'densidad_maxima', type:'int', nullable:true})
    densidadMaxima:number | null;

    @Column({name:'coef_constructibilidad', type:'decimal', precision:5, scale:2, nullable:true, transformer:decimalANumero})
    coefConstructibilidad:number | null;

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
