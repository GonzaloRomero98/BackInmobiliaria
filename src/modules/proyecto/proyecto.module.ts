import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Proyecto } from "./entities/proyecto.entity";
import { NormativaProyecto } from "./entities/normativaProyecto.entity";
import { PoryectoController } from "./proyecto.controller";
import { ProyectoService } from "./proyecto.service";
import { EntornoService } from "./entorno.service";
import { Ciudad } from "../ubicacion/entities/ciudad.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports:[TypeOrmModule.forFeature([Proyecto, Ciudad, NormativaProyecto]), AuthModule],
    controllers:[PoryectoController],
    providers:[ProyectoService, EntornoService],
    exports:[TypeOrmModule]
})
export class ProyectoModule{}
