import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Caracteristica } from "./entities/caracteristica.entity";
import { Raw, Repository } from "typeorm";
import { CrearCaractersiticaDto } from "./dto/crearCaracteristica.dto";

@Injectable()
export class CaracteristicaService{
    constructor(
        @InjectRepository(Caracteristica)
        private readonly caracteristicaRepository: Repository<Caracteristica>
    ){}

    async crearCaracteristica(crearCaractersiticaDto:CrearCaractersiticaDto):Promise<Caracteristica>{
        // Sin distinguir mayúsculas, igual que el índice único UQ_caracteristica_nombre_lower.
        const existeCaract = await this.caracteristicaRepository.findOne({
            where:{nombre:Raw((columna) => `LOWER(${columna}) = LOWER(:nombre)`, {nombre:crearCaractersiticaDto.nombre})},
        });
        if(existeCaract){
            throw new ConflictException('La caracteristica ingresada ya existe');
        }

        const caracteristica = await this.caracteristicaRepository.create({nombre:crearCaractersiticaDto.nombre});
        return this.caracteristicaRepository.save(caracteristica);
    }

    obtenerCaractersiticas():Promise<Caracteristica[]>{
        return this.caracteristicaRepository.find({order:{nombre:'ASC'}});
    }


}