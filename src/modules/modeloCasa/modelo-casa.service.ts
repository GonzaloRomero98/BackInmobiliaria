import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ModeloCasa } from "./entities/modeloCasa.entity";
import { Between, FindOptionsOrder, FindOptionsWhere, In, LessThanOrEqual, MoreThanOrEqual, Repository } from "typeorm";
import { Proyecto } from "../proyecto/entities/proyecto.entity";
import { CrearModeloCasaDto } from "./dto/CrearModeloCasa.dto";
import { Caracteristica } from "../caracteristicas/entities/caracteristica.entity";
import { GaleriaModeloCasa } from "./entities/galeriaModeloCasa.entity";
import { AgregarFotoDto } from "./dto/agregarFoto.dto";
import { ActualizarModeloCasaDto } from "./dto/actualizarModeloCasa.dto";
import { FiltrosModeloCasaDto, OrdenModelo } from "./dto/filtrosModeloCasa.dto";
import { EstadoModelo } from "./modelo-casa.enum";

const ORDEN: Record<OrdenModelo, FindOptionsOrder<ModeloCasa>> = {
    precio_asc: {precio:'ASC'},
    precio_desc: {precio:'DESC'},
    superficie_desc: {superficieConstruida:'DESC'},
    recientes: {creadoEn:'DESC'},
};

function rango(min?:number, max?:number){
    if(min !== undefined && max !== undefined) return Between(min, max);
    if(min !== undefined) return MoreThanOrEqual(min);
    if(max !== undefined) return LessThanOrEqual(max);
    return undefined;
}

@Injectable()
export class ModeloCasaService{
    constructor(
        @InjectRepository(ModeloCasa)
        private readonly modeloCasaRepository: Repository<ModeloCasa>,
        @InjectRepository(Proyecto)
        private readonly proyectoRepository: Repository<Proyecto>,
        @InjectRepository(Caracteristica)
        private readonly caracteristicaRepository: Repository<Caracteristica>,
        @InjectRepository(GaleriaModeloCasa)
        private readonly galeriaRepository: Repository<GaleriaModeloCasa>
    ){}

    async crearModeloCasa(crearModeloCasaDto:CrearModeloCasaDto):Promise<ModeloCasa>{
        const proyecto = await this.proyectoRepository.findOne({where:{id:crearModeloCasaDto.id_proyecto}});
        if(!proyecto){
            throw new NotFoundException('No se encuentra el proyecto');
        }

        const modeloCasa = new ModeloCasa();
            modeloCasa.proyecto = proyecto;
            modeloCasa.nombreModelo = crearModeloCasaDto.nombreModelo;
            modeloCasa.tipoOperacion = crearModeloCasaDto.tipoOperacion;
            modeloCasa.dormitorios = crearModeloCasaDto.dormitorios;
            modeloCasa.banos = crearModeloCasaDto.banos;
            modeloCasa.estacionamientos = crearModeloCasaDto.estacionamiento;
            modeloCasa.mascotas = crearModeloCasaDto.mascotas;
            modeloCasa.superficieConstruida = crearModeloCasaDto.superficieConstruida;
            modeloCasa.superficieTerreno = crearModeloCasaDto.superficieTerreno;
            modeloCasa.precio = crearModeloCasaDto.precio;
            modeloCasa.moneda = crearModeloCasaDto.moneda;
            modeloCasa.gastosComunes = crearModeloCasaDto.gastosComunes ?? false;
            modeloCasa.modelo3dUrl = crearModeloCasaDto.modelo3dUrl ?? null;
            modeloCasa.imgPrincipal = crearModeloCasaDto.imgPrincipal;
            modeloCasa.caracteristicas = await this.buscarCaracteristicas(crearModeloCasaDto.caracteristicasID);
            modeloCasa.estado = crearModeloCasaDto.estado ?? EstadoModelo.DISPONIBLE;
            modeloCasa.activo = crearModeloCasaDto.activo ?? true;

        const existeCasa = await this.modeloCasaRepository.findOne({where:{nombreModelo:modeloCasa.nombreModelo}});

        if(existeCasa){
            throw new ConflictException("Ya se ha ingresado esta propiedad")
        }

        return this.modeloCasaRepository.save(modeloCasa)

    }

    async actualizarModeloCasa(id:string, actualizarModeloCasaDto:ActualizarModeloCasaDto):Promise<ModeloCasa>{
        const modelo = await this.obtenerModeloAdmin(id);
        const {id_proyecto, estacionamiento, caracteristicasID, ...cambios} = actualizarModeloCasaDto;

        if(id_proyecto !== undefined){
            const proyecto = await this.proyectoRepository.findOne({where:{id:id_proyecto}});
            if(!proyecto){
                throw new NotFoundException('No se encuentra el proyecto');
            }
            modelo.proyecto = proyecto;
        }
        if(estacionamiento !== undefined) modelo.estacionamientos = estacionamiento;
        if(caracteristicasID !== undefined) modelo.caracteristicas = await this.buscarCaracteristicas(caracteristicasID);

        if(cambios.nombreModelo !== undefined && cambios.nombreModelo !== modelo.nombreModelo){
            const existeCasa = await this.modeloCasaRepository.findOne({where:{nombreModelo:cambios.nombreModelo}});
            if(existeCasa){
                throw new ConflictException("Ya se ha ingresado esta propiedad");
            }
        }

        Object.assign(modelo, cambios);
        return this.modeloCasaRepository.save(modelo);
    }

    async despublicarModeloCasa(id:string):Promise<void>{
        const resultado = await this.modeloCasaRepository.update({id, activo:true}, {activo:false});
        if(!resultado.affected){
            throw new NotFoundException('No se encontro el modelo de la casa');
        }
    }

    private async buscarCaracteristicas(ids:number[] = []):Promise<Caracteristica[]>{
        if(!ids.length) return [];
        const unicos = [... new Set(ids)];
        const caracteristicas = await this.caracteristicaRepository.findBy({id:In(unicos)});
        if(caracteristicas.length !== unicos.length){
            throw new BadRequestException('Algunas caracteristicas seleccionadas no existen');
        }
        return caracteristicas;
    }

    mostrarModelosCasa(filtros: FiltrosModeloCasaDto = {}):Promise<ModeloCasa[]>{
        const ciudad = filtros.id_ciudad || filtros.id_region
            ? {...(filtros.id_ciudad && {id:filtros.id_ciudad}), ...(filtros.id_region && {region:{id:filtros.id_region}})}
            : undefined;

        const filtro : FindOptionsWhere<ModeloCasa> = {
            activo:true,
            proyecto: {activo:true, ...(filtros.id_proyecto && {id:filtros.id_proyecto}), ...(ciudad && {ciudad})},
            ...(filtros.tipoOperacion && {tipoOperacion:filtros.tipoOperacion}),
            ...(filtros.moneda && {moneda:filtros.moneda}),
            ...(filtros.mascotas !== undefined && {mascotas:filtros.mascotas}),
        };

        const precio = rango(filtros.precioMin, filtros.precioMax);
        if(precio) filtro.precio = precio;
        if(filtros.dormitorios !== undefined) filtro.dormitorios = MoreThanOrEqual(filtros.dormitorios);
        if(filtros.banos !== undefined) filtro.banos = MoreThanOrEqual(filtros.banos);
        if(filtros.superficieMin !== undefined) filtro.superficieConstruida = MoreThanOrEqual(filtros.superficieMin);

        const orden = filtros.orden ? ORDEN[filtros.orden] : {nombreModelo:'ASC' as const};
        return this.modeloCasaRepository.find({where:filtro, order:{...orden, fotos:{orden:'ASC'}}});
    }

    async obtenerModeloByID(id:string): Promise<ModeloCasa>{
        const modelo = await this.modeloCasaRepository.findOne({where:{id:id,activo:true,proyecto:{activo:true}},order:{fotos:{orden:'ASC'}}});

        if(!modelo){
            throw new NotFoundException('No se encontro el modelo de la casa');
        }

        return modelo;
    }

    // Panel admin: incluye borradores y modelos de proyectos despublicados
    listarModelosAdmin():Promise<ModeloCasa[]>{
        return this.modeloCasaRepository.find({order:{nombreModelo:'ASC', fotos:{orden:'ASC'}}});
    }

    async obtenerModeloAdmin(id:string):Promise<ModeloCasa>{
        const modelo = await this.modeloCasaRepository.findOne({where:{id}, order:{fotos:{orden:'ASC'}}});
        if(!modelo){
            throw new NotFoundException('No se encontro el modelo de la casa');
        }
        return modelo;
    }

    async agregarFoto(id:string, agregarFotoDto: AgregarFotoDto){
        const modelo = await this.modeloCasaRepository.findOne({where:{id}});
        if(!modelo){
            throw new NotFoundException('Modelo de la casa no encontrado');
        }

        const existeFoto = await this.galeriaRepository.findOne({where:{urlImagen:agregarFotoDto.urlImagen, modeloCasa:{id}}});

        if(existeFoto){
            throw new ConflictException('Esta foto ya esta en la galeria del modelo de casa')
        }

        const foto = new GaleriaModeloCasa();
            foto.modeloCasa = modelo;
            foto.urlImagen = agregarFotoDto.urlImagen;
            foto.orden = agregarFotoDto.orden ?? await this.galeriaRepository.count({where:{modeloCasa:{id}}});

        const guardarFoto = await this.galeriaRepository.save(foto);
        return {id:guardarFoto.id, urlImagen:guardarFoto.urlImagen, orden:guardarFoto.orden};
    }

    async eliminarFoto(id:string, foto_id:string):Promise<void>{
        const foto = await this.galeriaRepository.findOne({where:{id:foto_id, modeloCasa:{id}}});

        if(!foto){
            throw new NotFoundException('Foto no encontrada');
        }

        await this.galeriaRepository.remove(foto);
    }
}