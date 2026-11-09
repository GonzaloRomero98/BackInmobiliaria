import { Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Proyecto } from "../../proyecto/entities/proyecto.entity";
import { Caracteristica } from "../../caracteristicas/entities/caracteristica.entity";
import { GaleriaModeloCasa } from "./galeriaModeloCasa.entity";
import { decimalANumero } from "../../../database/transformadores";
import { EstadoModelo, TipoVivienda } from "../modelo-casa.enum";

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

    @Column({name:'superficie_construida', type:'decimal', transformer:decimalANumero})
    superficieConstruida:number;

    @Column({name:'tipo_vivienda', type:'varchar', length:20, default:TipoVivienda.CASA})
    tipoVivienda:string;

    // Obligatoria solo en casas (un departamento no tiene terreno propio); se valida en el servicio
    @Column({name:'superficie_terreno', type:'decimal', nullable:true, transformer:decimalANumero})
    superficieTerreno:number | null;

    @Column({type:'decimal', precision:12, scale:4, transformer:decimalANumero})
    precio:number;

    @Column({type:'varchar', length:3})
    moneda:string;

    // Monto mensual en CLP; null = no aplica o no informado
    @Column({name:'gastos_comunes', type:'int', nullable:true})
    gastosComunes:number | null;

    @Column({name:'modelo_3d_url', type:'varchar', nullable:true})
    modelo3dUrl:string | null;

    @Column({name:'plano_url', type:'varchar', nullable:true})
    planoUrl:string | null;

    @Column({type:'text', array:true, default:'{}'})
    subsidios:string[];

    @Column({type:'varchar', length:150, nullable:true})
    bono:string | null;

    @Column({name:'img_principal', type:'varchar',nullable:false})
    imgPrincipal:string;

    // Calculado por calcularEstado() desde los contadores; no se edita a mano. "activo" indica publicado o borrador
    @Column({type:'varchar', length:20, default:EstadoModelo.DISPONIBLE})
    estado:string;

    // Casas de este modelo en el proyecto (las define el admin)
    @Column({type:'int', default:1})
    unidades:number;

    // Contadores: solo los modifica ReservaService
    @Column({name:'unidades_reservadas', type:'int', default:0})
    unidadesReservadas:number;

    @Column({name:'unidades_vendidas', type:'int', default:0})
    unidadesVendidas:number;

    @Column({default:true})
    activo:boolean;

    @CreateDateColumn()
    creadoEn: Date;

    @ManyToOne(()=>Proyecto,{eager:true, nullable:false})
    @JoinColumn({name:'id_proyecto'})
    proyecto:Proyecto

    @ManyToMany(()=> Caracteristica,{eager:true})
    @JoinTable({
        name:'modelo_caracteristica',
        joinColumn:{name:'id_modelo_casa', referencedColumnName:'id'},
        inverseJoinColumn:{name:'id_caracteristica', referencedColumnName:'id'}
    })
    caracteristicas: Caracteristica[];

    // cascade insert: al duplicar, el modelo y su galería se guardan en la misma transacción
    @OneToMany(()=> GaleriaModeloCasa,(foto) => foto.modeloCasa,{eager:true, cascade:['insert']})
    fotos:GaleriaModeloCasa[];
}