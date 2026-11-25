import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Region } from "./entities/region.entity";
import { Ciudad } from "./entities/ciudad.entity";
import { UbicacionController } from "./ubicacion.controller";
import { UbicacionService } from "./ubicacion.service";
import { DireccionService } from "./direccion.service";

@Module({
    imports:[TypeOrmModule.forFeature([Ciudad, Region])],
    controllers:[UbicacionController],
    providers:[UbicacionService, DireccionService],
})

export class UbicacionModule{}