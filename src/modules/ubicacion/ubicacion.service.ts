import { Injectable, Query } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Ciudad } from "./entities/ciudad.entity";
import { Repository } from "typeorm";
import {Region } from "./entities/region.entity";

@Injectable()
export class UbicacionService{
    constructor(
        @InjectRepository(Ciudad)
        private readonly ciudadRepo:Repository<Ciudad>,
        @InjectRepository(Region)
        private readonly regionRepo: Repository<Region>,
    ){}

    obtenerRegiones(){
        return this.regionRepo.find({order:{nombre:'ASC'}})
    }

    obtenerCiudades(id_region?:number){
        return this.ciudadRepo.find({
            where: id_region?{region:{id:id_region}}:{},
            order:{nombre:'ASC'}
        });
    }

}