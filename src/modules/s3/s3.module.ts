import { Module } from "@nestjs/common";
import { S3Service } from "./s3.service";
import { S3Controller } from "./s3.controller";

// No importa AuthModule para no formar un ciclo entre Auth, Usuario y S3.
// El guard JWT usa la estrategia que registra AppModule.
@Module({
    controllers:[S3Controller],
    providers:[S3Service],
    exports:[S3Service]
})

export class S3Module{}
