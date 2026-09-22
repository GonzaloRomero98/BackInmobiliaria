import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Solicitud } from "./entities/solicitud.entity";
import { ModeloCasa } from "../modelo-casa/entities/modeloCasa.entity";
import { AuthModule } from "../auth/auth.module";
import { SolicitudController } from "./solicitud.controller";
import { SolicitudService } from "./solicitud.service";

@Module({
    imports:[TypeOrmModule.forFeature([Solicitud, ModeloCasa]), AuthModule],
    controllers:[SolicitudController],
    providers:[SolicitudService],
    exports:[TypeOrmModule]
})
export class SolicitudModule{}