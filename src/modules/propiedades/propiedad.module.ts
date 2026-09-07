import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Propiedad } from "./entities/propiedad.entity";
import { S3Module } from "../s3/s3.module";
import { PropiedadControler } from "./propiedad.controller";
import { PropiedadService } from "./propiedad.service";

@Module({
    imports:[TypeOrmModule.forFeature([Propiedad]), S3Module],
    controllers:[PropiedadControler],
    providers:[PropiedadService]
})

export class PorpiedadModule {}