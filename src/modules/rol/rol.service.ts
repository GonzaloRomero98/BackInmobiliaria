import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Rol } from "./entities/rol.entities";
import { Repository } from "typeorm";

@Injectable()
export class RolService{
    constructor(
        @InjectRepository(Rol)
        private readonly rolRepo : Repository<Rol>
    ){}

    async ObtenerTodosRoles(){
        return this.rolRepo.find({order:{id:'ASC'}});
    }
}