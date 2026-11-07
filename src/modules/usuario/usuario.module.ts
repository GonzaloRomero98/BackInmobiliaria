import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Usuario } from "./entities/usuario.entity";
import { UsuarioService } from "./usuario.service";
import { RolModule } from "../rol/rol.module";
import { S3Module } from "../s3/s3.module";

@Module({
    imports:[TypeOrmModule.forFeature([Usuario]), RolModule, S3Module],
    providers:[UsuarioService],
    exports:[UsuarioService]
})

export class UsuarioModule {}
