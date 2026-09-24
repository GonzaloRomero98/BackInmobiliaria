import { Module } from "@nestjs/common";
import { S3Service } from "./s3.service";
import { AuthModule } from "../auth/auth.module";
import { S3Controller } from "./s3.controller";

@Module({
    imports:[AuthModule],
    controllers:[S3Controller],
    providers:[S3Service],
    exports:[S3Service]
})

export class S3Module{}