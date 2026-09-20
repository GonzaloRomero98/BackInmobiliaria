import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Proyecto } from "./entities/proyecto.entity";
import { PoryectoController } from "./proyecto.controller";
import { ProyectoService } from "./proyecto.service";
import { Ciudad } from "../ubicacion/entities/ciudad.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports:[TypeOrmModule.forFeature([Proyecto, Ciudad]), AuthModule],
    controllers:[PoryectoController],
    providers:[ProyectoService],
    exports:[TypeOrmModule, ProyectoModule]
})
export class ProyectoModule{}