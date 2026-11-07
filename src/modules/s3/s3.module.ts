import { Module } from "@nestjs/common";
import { S3Service } from "./s3.service";
import { S3Controller } from "./s3.controller";

// Sin importar AuthModule: el guard JWT usa la estrategia que registra AppModule, y así
// UsuarioModule puede importar este módulo sin formar un ciclo (Auth -> Usuario -> S3 -> Auth).
@Module({
    controllers:[S3Controller],
    providers:[S3Service],
    exports:[S3Service]
})

export class S3Module{}
