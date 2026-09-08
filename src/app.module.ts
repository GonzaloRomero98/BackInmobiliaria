import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PorpiedadModule } from "./modules/propiedades/propiedad.module";
import { InvitadoModule } from "./modules/invitado/invitado.module";
import { S3Module } from "./modules/s3/s3.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsuarioModule } from "./modules/usuario/usuario.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get("DB_HOST"),
        port: config.get<number>("DB_PORT"),
        username: config.get("DB_USERNAME"),
        password: config.get("DB_PASSWORD"),
        database: config.get("DB_NAME"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: true,
        ssl: {
          rejectUnauthorized: false,
        },
      }),
    }),
    PorpiedadModule,
    InvitadoModule,
    S3Module,
    AuthModule,
    UsuarioModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
