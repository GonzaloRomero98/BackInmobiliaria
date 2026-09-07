import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Invitado } from "./entities/invitado.entity";
import { InvitadoController } from "./invitado.controller";
import { InvitadoService } from "./invitado.service";

@Module({
    imports:[TypeOrmModule.forFeature([Invitado])],
    controllers:[InvitadoController],
    providers:[InvitadoService]
})
export class InvitadoModule{}