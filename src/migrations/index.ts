import { MigrationInterface } from "typeorm";
import { Inicial1792961995584 } from "./1792961995584-Inicial";
import { AuditoriaYConsentimiento1792962300589 } from "./1792962300589-AuditoriaYConsentimiento";
import { UbicacionYNormativa1792964432925 } from "./1792964432925-UbicacionYNormativa";
import { Modelo3dOpcional1793061559516 } from "./1793061559516-Modelo3dOpcional";
import { EstadoModelo1793150000000 } from "./1793150000000-EstadoModelo";
import { DatosComerciales1793300000000 } from "./1793300000000-DatosComerciales";
import { FotoPerfil1793400000000 } from "./1793400000000-FotoPerfil";
import { SalaVentasYVisita1793500000000 } from "./1793500000000-SalaVentasYVisita";
import { SesionesYAuditoriaInmutable1793600000000 } from "./1793600000000-SesionesYAuditoriaInmutable";
import { UnidadesYReservas1793700000000 } from "./1793700000000-UnidadesYReservas";
import { AuditoriaEncadenada1793800000000 } from "./1793800000000-AuditoriaEncadenada";
import { EventosModelo1793900000000 } from "./1793900000000-EventosModelo";

// Registro explícito de migraciones (en orden). Al generar una nueva con
// `npm run migration:generate -- src/migrations/<Nombre>`, agrégala a esta lista.
export const migraciones: (new () => MigrationInterface)[] = [
    Inicial1792961995584,
    AuditoriaYConsentimiento1792962300589,
    UbicacionYNormativa1792964432925,
    Modelo3dOpcional1793061559516,
    EstadoModelo1793150000000,
    DatosComerciales1793300000000,
    FotoPerfil1793400000000,
    SalaVentasYVisita1793500000000,
    SesionesYAuditoriaInmutable1793600000000,
    UnidadesYReservas1793700000000,
    AuditoriaEncadenada1793800000000,
    EventosModelo1793900000000,
];
