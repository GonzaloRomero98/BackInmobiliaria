import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RolService } from "./rol.service";
import { Rol } from "./entities/rol.entities";

@Module({
    imports:[TypeOrmModule.forFeature([Rol])],
    providers:[RolService],
    exports:[RolService]
})

export class RolModule{}