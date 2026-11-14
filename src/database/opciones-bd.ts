import { readFileSync } from "fs";
import { join } from "path";
import { DataSourceOptions } from "typeorm";
import { migraciones } from "../migrations";

type LeerVariable = (clave: string) => string | undefined;

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
        // El esquema se maneja con migraciones. synchronize solo se usa en pruebas locales.
        synchronize: leer("DB_SYNCHRONIZE") === "true",
        migrationsRun: leer("DB_MIGRATIONS_RUN") !== "false",
        ssl: opcionesSsl(leer),
    };
}

function opcionesSsl(leer: LeerVariable) {
    if (leer("DB_SSL") === "false") {
        return false;
    }
    return {
        // Se verifica el certificado del servidor con la CA de AWS RDS.
        ca: readFileSync(leer("DB_SSL_CA") ?? join(process.cwd(), "certs", "rds-global-bundle.pem"), "utf8"),
        rejectUnauthorized: leer("DB_SSL_REJECT_UNAUTHORIZED") !== "false",
    };
}
