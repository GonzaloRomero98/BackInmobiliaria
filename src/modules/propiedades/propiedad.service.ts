import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm/repository/Repository.js";
import { Propiedad } from "./entities/propiedad.entity";
import { CrearPropiedadDto } from "./entities/crearPropiedad.entity";
import { S3Service } from "../s3/s3.service";

@Injectable()
export class PropiedadService{
    constructor(
        @InjectRepository(Propiedad)
        private readonly propiedadRepostorio: Repository<Propiedad>,
        private readonly s3Service: S3Service
    ){}

    async crearPropiedad(crearpropiedadDTO: CrearPropiedadDto): Promise<Propiedad> {
        const propiedad = this.propiedadRepostorio.create(crearpropiedadDTO);
        return this.propiedadRepostorio.save(propiedad);
    }

    async encontrarDisponibles():Promise<Propiedad[]>{
        return this.propiedadRepostorio.find({
            where:{disponible: true},
            order: { creadoEn: 'DESC'},
        });
    }

    async buscarPropiedadPorID(id:string):Promise<Propiedad>{
        const propiedad = await this.propiedadRepostorio.findOne({where:{id}});
        if(!propiedad){
            throw new NotFoundException('Propiedad no encontrada');
        }

        return propiedad;
    }

    async subirUrl(archivo:string, contentType:string){
        return this.s3Service.obtenerUrl(archivo, contentType);
    }
}