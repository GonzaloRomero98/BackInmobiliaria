import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ModeloCasa } from "./entities/modeloCasa.entity";
import { Proyecto } from "../proyecto/entities/proyecto.entity";
import { AuthModule } from "../auth/auth.module";
import { ModeloCasaController } from "./modelo-casa.controller";
import { ModeloCasaService } from "./modelo-casa.service";
import { Caracteristica } from "../caracteristicas/entities/caracteristica.entity";

@Module({
    imports:[TypeOrmModule.forFeature([ModeloCasa, Proyecto, Caracteristica]), AuthModule],
    controllers:[ModeloCasaController],
    providers:[ModeloCasaService],
    exports:[TypeOrmModule]
})
export class ModeloCasaModule{}