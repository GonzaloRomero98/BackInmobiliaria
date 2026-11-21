import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ModeloCasa } from "./entities/modeloCasa.entity";
import { Proyecto } from "../proyecto/entities/proyecto.entity";
import { AuthModule } from "../auth/auth.module";
import { ModeloCasaController } from "./modelo-casa.controller";
import { ModeloCasaService } from "./modelo-casa.service";
import { Caracteristica } from "../caracteristicas/entities/caracteristica.entity";
import { GaleriaModeloCasa } from "./entities/galeriaModeloCasa.entity";
import { S3Module } from "../s3/s3.module";

@Module({
    imports:[TypeOrmModule.forFeature([ModeloCasa, Proyecto, Caracteristica, GaleriaModeloCasa]), AuthModule, S3Module],
    controllers:[ModeloCasaController],
    providers:[ModeloCasaService],
})
export class ModeloCasaModule{}