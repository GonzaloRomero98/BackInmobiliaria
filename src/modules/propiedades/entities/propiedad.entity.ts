import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Invitado } from "../../invitado/entities/invitado.entity";

export enum TipoPropiedad {
    CASA = 'CASA',
    DEPARTAMENTO = 'DEPARTAMENTO'
}

export enum EstadoPropiedad {
    VENTA = 'VENTA',
    ARRIENDO = 'ARRIENDO'
}

@Entity('propiedad')
export class Propiedad {

    @PrimaryGeneratedColumn('uuid')
    id:string;

    @Column()
    titulo:string;

    @Column()
    descripcion:string;

    @Column({
        type: 'enum',
        enum: TipoPropiedad,
        default: TipoPropiedad.CASA,
    })
    tipoPropiedad: TipoPropiedad;

    @Column({
        type: 'enum',
        enum: EstadoPropiedad,
        default: EstadoPropiedad.VENTA,
    })
    estadoPropiedad: EstadoPropiedad;

    @Column('decimal', { precision: 12, scale: 0 })
    precio:number;

    @Column('decimal', { precision: 10, scale: 0 })
    gastosComunes:number;

    @Column()
    comuna:string;

    @Column()
    ciudad:string;

    @Column()
    direccion:string;

    @Column()
    banos:number;

    @Column()
    dormitorios:number;

    @Column({nullable: true})
    estacionamientos:number;

    @Column({nullable: true})
    mascotas:boolean;

    @Column('decimal', { precision: 8, scale: 0, nullable: true })
    totalMetrosCuadrados:number;

    @Column('decimal', { precision: 8, scale: 0, nullable: true })
    metrosCuadradosconstruidos:number;

    @Column({nullable: true})
    anoConstruccion:number;

    @Column({nullable: true})
    piso:number;

    @Column('simple-array', {nullable: true})
    comodidades:string[];

    @Column()
    modelo3dUrl:string;

    @Column()
    portadaimgUrl:string

    @Column({default: true})
    disponible:boolean;

    @CreateDateColumn()
    creadoEn: Date;

    @OneToMany(()=> Invitado, (invitado)=> invitado.propiedad)
    invitados: Invitado[];

}