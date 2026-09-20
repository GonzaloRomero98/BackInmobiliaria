import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Usuario } from "./entities/usuario.entity";
import { UsuarioService } from "./usuario.service";
import { RolModule } from "../rol/rol.module";

@Module({
    imports:[TypeOrmModule.forFeature([Usuario]), RolModule],
    providers:[UsuarioService],
    exports:[UsuarioService]
})

export class UsuarioModule {}