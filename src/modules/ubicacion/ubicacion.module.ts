import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Region } from "./entities/region.entity";
import { Ciudad } from "./entities/ciudad.entity";
import { UbicacionController } from "./ubicacion.controller";
import { UbicacionService } from "./ubicacion.service";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports:[TypeOrmModule.forFeature([Ciudad, Region]),AuthModule],
    controllers:[UbicacionController],
    providers:[UbicacionService],
    exports:[UbicacionService]
})

export class UbicacionModule{}