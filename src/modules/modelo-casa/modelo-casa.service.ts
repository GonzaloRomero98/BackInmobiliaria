import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ModeloCasa } from "./entities/modeloCasa.entity";
import { FindOptionsWhere, Repository } from "typeorm";
import { Proyecto } from "../proyecto/entities/proyecto.entity";
import { CrearModeloCasaDto } from "./dto/CrearModeloCasa.dto";

@Injectable()
export class ModeloCasaService{
    constructor(
        @InjectRepository(ModeloCasa)
        private readonly modeloCasaRepository: Repository<ModeloCasa>,
        @InjectRepository(Proyecto)
        private readonly proyectoRepository: Repository<Proyecto>
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

        return this.modeloCasaRepository.find({where:filtro, order:{nombreModelo:'ASC'}});
    }

    async obtenerModeloByID(id:string): Promise<ModeloCasa>{
        const modelo = await this.modeloCasaRepository.findOne({where:{id:id,activo:true,proyecto:{activo:true}}});

        if(!modelo){
            throw new NotFoundException('No se encontro el modelo de la casa');
        }

        return modelo;
    }
}