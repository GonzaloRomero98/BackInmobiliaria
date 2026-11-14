import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Auditoria } from "./entities/auditoria.entity";
import { AuditoriaService } from "./auditoria.service";
import { AuditoriaController } from "./auditoria.controller";
import { AuthModule } from "../auth/auth.module";
import { Proyecto } from "../proyecto/entities/proyecto.entity";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { Usuario } from "../usuario/entities/usuario.entity";

@Global()
@Module({
    imports:[TypeOrmModule.forFeature([Auditoria, Proyecto, ModeloCasa, Usuario]), AuthModule],
    controllers:[AuditoriaController],
    providers:[AuditoriaService],
    exports:[AuditoriaService]
})
export class AuditoriaModule{}
