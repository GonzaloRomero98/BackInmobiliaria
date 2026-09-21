import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Proyecto } from "./entities/proyecto.entity";
import { Repository } from "typeorm";
import { Ciudad } from "../ubicacion/entities/ciudad.entity";
import { CrearProyectoDto } from "./dto/crearProyecto.dto";

@Injectable()
export class ProyectoService{
    constructor(
        @InjectRepository(Proyecto)
        private readonly proyectoRepository: Repository<Proyecto>,
        @InjectRepository(Ciudad)
        private readonly ciudadRepository:Repository<Ciudad>
    ){}

    async crearProyecto(crearPoroyectoDto: CrearProyectoDto): Promise<Proyecto>{
        const ciudad = await this.ciudadRepository.findOne({where:{id:crearPoroyectoDto.id_ciudad}});
        if(!ciudad){
            throw new NotFoundException('La ciudad seleccionada no existe en la bd');
        }
        const proyecto = this.proyectoRepository.create({
            nombre: crearPoroyectoDto.nombre,
            descripcion: crearPoroyectoDto.descripcion,
            imagenPortada: crearPoroyectoDto.imagenPortada,
            ciudad
        });
        return this.proyectoRepository.save(proyecto)
    }

    mostrarProyectos(id_ciudad?:number):Promise<Proyecto[]>{
        return this.proyectoRepository.find({
            where:id_ciudad?{activo:true, ciudad:{id:id_ciudad}}:{activo:true}, order:{nombre:'ASC'}
        });
    }

    async obtenerProyectoPorID(id:string): Promise<Proyecto>{
        const proyecto = await this.proyectoRepository.findOne({where:{id,activo:true}});
        if(!proyecto){
            throw new NotFoundException('El proyecto no fue encontrado');
        }
        return proyecto;
    }
}                              