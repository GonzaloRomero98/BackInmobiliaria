import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { Solicitud } from "../solicitud/entities/solicitud.entity";
import { Proyecto } from "../proyecto/entities/proyecto.entity";
import { Reserva } from "../reserva/entities/reserva.entity";
import { AuthModule } from "../auth/auth.module";
import { MetricasController } from "./metricas.controller";
import { MetricasService } from "./metricas.service";
import { EventoModelo } from "./entities/eventoModelo.entity";

@Module({
    imports:[TypeOrmModule.forFeature([ModeloCasa, Solicitud, Proyecto, Reserva, EventoModelo]), AuthModule],
    controllers:[MetricasController],
    providers:[MetricasService]
})
export class MetricasModule{}
