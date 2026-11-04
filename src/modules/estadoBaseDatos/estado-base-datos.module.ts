import { Module } from "@nestjs/common";
import { EstadoBaseDatosController } from "./estado-base-datos.controller";

@Module({
    controllers:[EstadoBaseDatosController],
})
export class EstadoBaseDatosModule{}
