import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Reserva } from "./entities/reserva.entity";
import { Solicitud } from "../solicitud/entities/solicitud.entity";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { AuthModule } from "../auth/auth.module";
import { ReservaController } from "./reserva.controller";
import { ReservaService } from "./reserva.service";

@Module({
    imports:[TypeOrmModule.forFeature([Reserva, Solicitud, ModeloCasa]), AuthModule],
    controllers:[ReservaController],
    providers:[ReservaService],
})
export class ReservaModule{}
