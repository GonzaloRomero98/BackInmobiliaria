import "reflect-metadata";
import { DataSource } from "typeorm";
import { opcionesBaseDatos } from "./database/opciones-bd";

// DataSource para la CLI de TypeORM (npm run migration:*). La app usa la misma configuración vía AppModule.
try {
    process.loadEnvFile();
} catch {
    // sin .env: se usan las variables de entorno del sistema
}

export default new DataSource(opcionesBaseDatos((clave) => process.env[clave]));
