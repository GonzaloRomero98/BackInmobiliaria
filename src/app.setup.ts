import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

// Configuración HTTP común a main.ts y a los tests e2e.
export function configurarApp(app: INestApplication) {
  const config = app.get(ConfigService);

  app.use(helmet());

  // Solo los orígenes del frontend (lista separada por comas en CORS_ORIGINS)
  const origenes = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);
  // credentials: en desarrollo el front (:3000) y la API (:3001) son orígenes distintos y la cookie de sesión debe viajar
  app.enableCors({ origin: origenes, credentials: true });

  // Detrás de un proxy/balanceador (p. ej. ALB o Nginx) para que req.ip sea la IP real del cliente
  const trustProxy = config.get<string>('TRUST_PROXY');
  if (trustProxy) {
    (app as NestExpressApplication).set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  // Documentación OpenAPI en /api/docs: apagada por defecto, se activa con SWAGGER=true (ISO 27001 A.8.9)
  if (config.get<string>('SWAGGER') === 'true') {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Inmocap API')
        .setDescription('API de proyectos inmobiliarios, modelos de casa y solicitudes de contacto')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, documento);
  }

  Logger.log(`CORS habilitado para: ${origenes.join(', ')}`, 'Bootstrap');
}
