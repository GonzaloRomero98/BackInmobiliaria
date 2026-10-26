import { readFileSync } from "fs";
import { join } from "path";
import { DataSourceOptions } from "typeorm";
import { migraciones } from "../migrations";

type LeerVariable = (clave: string) => string | undefined;

// Configuración única de la BD, usada por AppModule y por la CLI de migraciones (data-source.ts).
export function opcionesBaseDatos(leer: LeerVariable): DataSourceOptions {
    return {
        type: "postgres",
        host: leer("DB_HOST"),
        port: Number(leer("DB_PORT") ?? 5432),
        username: leer("DB_USERNAME"),
        password: leer("DB_PASSWORD"),
        database: leer("DB_NAME"),
        entities: [join(__dirname, "..", "**", "*.entity{.ts,.js}")],
        migrations: migraciones,
        // El esquema se gestiona con migraciones; synchronize solo para pruebas locales desechables.
        synchronize: leer("DB_SYNCHRONIZE") === "true",
        migrationsRun: leer("DB_MIGRATIONS_RUN") !== "false",
        ssl: opcionesSsl(leer),
    };
}

function opcionesSsl(leer: LeerVariable) {
    if (leer("DB_SSL") === "false") {
        return false;
    }
    // Verifica el certificado del servidor contra la CA de AWS RDS (certs/rds-global-bundle.pem).
    return {
        ca: readFileSync(leer("DB_SSL_CA") ?? join(process.cwd(), "certs", "rds-global-bundle.pem"), "utf8"),
        rejectUnauthorized: leer("DB_SSL_REJECT_UNAUTHORIZED") !== "false",
    };
}
