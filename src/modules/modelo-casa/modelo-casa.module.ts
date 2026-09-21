import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ModeloCasa } from "./modelo-casa.service";
import { Proyecto } from "../proyecto/entities/proyecto.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports:[TypeOrmModule.forFeature([ModeloCasa, Proyecto]), AuthModule],
    exports:[TypeOrmModule]
})
export class ModeloCasaModule{}