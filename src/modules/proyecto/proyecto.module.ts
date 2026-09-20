import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Proyecto } from "./entities/proyecto.entity";
import { PoryectoController } from "./proyecto.controller";
import { ProyectoService } from "./proyecto.service";

@Module({
    imports:[TypeOrmModule.forFeature([Proyecto])],
    controllers:[PoryectoController],
    providers:[ProyectoService],
    exports:[TypeOrmModule, ProyectoModule]
})
export class ProyectoModule{}