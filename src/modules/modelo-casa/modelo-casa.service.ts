import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ModeloCasa } from "./entities/modeloCasa.entity";
import { FindOptionsWhere, In, Repository } from "typeorm";
import { Proyecto } from "../proyecto/entities/proyecto.entity";
import { CrearModeloCasaDto } from "./dto/CrearModeloCasa.dto";
import { Caracteristica } from "../caracteristicas/entities/caracteristica.entity";
import { GaleriaModeloCasa } from "./entities/galeriaModeloCasa.entity";
import { AgregarFotoDto } from "./dto/agregarFoto.dto";

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
            modeloCasa.gastosComunes = crearModeloCasaDto.gastosComunes;
            modeloCasa.modelo3dUrl = crearModeloCasaDto.modelo3dUrl;
            modeloCasa.imgPrincipal = crearModeloCasaDto.imagenPrincipal;
            modeloCasa.caracteristicas = [];
            if(crearModeloCasaDto.caracteristicasID?.length){
                const ids = [... new Set(crearModeloCasaDto.caracteristicasID)];
                const caracteristicas = await this.caracteristicaRepository.findBy({id:In(ids)});
                if(caracteristicas.length ! == ids.length){
                    throw new BadRequestException('Algunas caracteristicas seleccionadas no existen');
                }
                modeloCasa.caracteristicas = caracteristicas;
            }

        const existeCasa = await this.modeloCasaRepository.findOne({where:{nombreModelo:modeloCasa.nombreModelo}});

        if(existeCasa){
            throw new NotFoundException("Ya se ha ingresado esta propiedad")
        }
        
        return this.modeloCasaRepository.save(modeloCasa)

    }

    mostrarModelosCasa(id_proyecto?:string, tipoOperacion?:string):Promise<ModeloCasa[]>{
        const filtro : FindOptionsWhere<ModeloCasa> = {
            activo:true,
            proyecto: id_proyecto ? {id:id_proyecto , activo:true} : {activo:true}
        }
        if(tipoOperacion){
            filtro.tipoOperacion = tipoOperacion;
        }

        return this.modeloCasaRepository.find({where:filtro, order:{nombreModelo:'ASC', fotos:{orden:'ASC'}}});
    }

    async obtenerModeloByID(id:string): Promise<ModeloCasa>{
        const modelo = await this.modeloCasaRepository.findOne({where:{id:id,activo:true,proyecto:{activo:true}},order:{fotos:{orden:'ASC'}}});

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

        await this.galeriaRepository.recover(foto);
    }
}