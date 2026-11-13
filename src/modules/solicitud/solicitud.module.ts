import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Solicitud } from "./entities/solicitud.entity";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { Reserva } from "../reserva/entities/reserva.entity";
import { AuthModule } from "../auth/auth.module";
import { SolicitudController } from "./solicitud.controller";
import { SolicitudService } from "./solicitud.service";
import { NotaSolicitud } from "./entities/notaSolicitud.entity";
import { Cotizacion } from "./entities/cotizacion.entity";

@Module({
    imports:[TypeOrmModule.forFeature([Solicitud, ModeloCasa, Reserva, NotaSolicitud, Cotizacion]), AuthModule],
    controllers:[SolicitudController],
    providers:[SolicitudService],
    exports:[TypeOrmModule]
})
export class SolicitudModule{}