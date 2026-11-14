import "reflect-metadata";
import { DataSource } from "typeorm";
import { opcionesBaseDatos } from "./database/opciones-bd";

try {
    process.loadEnvFile();
} catch {
    // Sin .env se usan las variables de entorno del sistema.
}

export default new DataSource(opcionesBaseDatos((clave) => process.env[clave]));
