import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Invitado } from "./entities/invitado.entity";
import { InvitadoController } from "./invitado.controller";
import { InvitadoService } from "./invitado.service";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports:[TypeOrmModule.forFeature([Invitado]), AuthModule],
    controllers:[InvitadoController],
    providers:[InvitadoService]
})
export class InvitadoModule{}