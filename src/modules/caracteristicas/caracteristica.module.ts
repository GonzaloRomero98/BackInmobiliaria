import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Caracteristica } from "./entities/caracteristica.entity";
import { AuthModule } from "../auth/auth.module";
import { CaracteristicasController } from "./caracteristica.controller";
import { CaracteristicaService } from "./caracteristica.service";

@Module({
    imports:[TypeOrmModule.forFeature([Caracteristica]), AuthModule],
    controllers:[CaracteristicasController],
    providers:[CaracteristicaService],
    exports:[TypeOrmModule]
})
export class CaracteristicaModule{}