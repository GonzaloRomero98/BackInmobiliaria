import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Auditoria } from "./entities/auditoria.entity";
import { AuditoriaService } from "./auditoria.service";
import { AuditoriaController } from "./auditoria.controller";
import { AuthModule } from "../auth/auth.module";

@Global()
@Module({
    imports:[TypeOrmModule.forFeature([Auditoria]), AuthModule],
    controllers:[AuditoriaController],
    providers:[AuditoriaService],
    exports:[AuditoriaService]
})
export class AuditoriaModule{}
