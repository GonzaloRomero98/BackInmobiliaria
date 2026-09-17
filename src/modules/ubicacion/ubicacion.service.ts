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

    async encontrarCiudadPorRegion(id_Region:number):Promise<Ciudad[]>{
        return this.ciudadRepo.find({
            where:{region: {id: id_Region}},
            order: {nombre:'ASC'}
        });
    }

    async obtenerRegion(){
        return this.regionRepo.find({order:{id:'ASC'}})
    }


}