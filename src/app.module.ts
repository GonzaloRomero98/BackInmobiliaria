import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { S3Module } from "./modules/s3/s3.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsuarioModule } from "./modules/usuario/usuario.module";
import { UbicacionModule } from "./modules/ubicacion/ubicacion.module";
import { RolModule } from "./modules/rol/rol.module";
import { ProyectoModule } from "./modules/proyecto/proyecto.module";
import { ModeloCasaModule } from "./modules/modeloCasa/modelo-casa.module";
import { CaracteristicaModule } from "./modules/caracteristicas/caracteristica.module";
import { SolicitudModule } from "./modules/solicitud/solicitud.module";
import { AuditoriaModule } from "./modules/auditoria/auditoria.module";
import { AuditoriaMiddleware } from "./modules/auditoria/auditoria.middleware";
import { SaludModule } from "./modules/salud/salud.module";
import { MetricasModule } from "./modules/metricas/metricas.module";
import { opcionesBaseDatos } from "./database/opciones-bd";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        opcionesBaseDatos((clave) => config.get<string>(clave)),
    }),
    // Límite general por IP; login y formulario público tienen límites más estrictos
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    AuditoriaModule,
    SaludModule,
    S3Module,
    AuthModule,
    UsuarioModule,
    UbicacionModule,
    RolModule,
    ProyectoModule,
    ModeloCasaModule,
    CaracteristicaModule,
    SolicitudModule,
    MetricasModule
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditoriaMiddleware).forRoutes("*");
  }
}
