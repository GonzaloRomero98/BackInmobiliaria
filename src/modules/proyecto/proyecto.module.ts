import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Proyecto } from "./entities/proyecto.entity";

@Module({
    imports:[TypeOrmModule.forFeature([Proyecto])],
    exports:[TypeOrmModule]
})
export class ProyectoModule{}