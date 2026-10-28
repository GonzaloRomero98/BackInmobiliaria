import { MigrationInterface } from "typeorm";
import { Inicial1792961995584 } from "./1792961995584-Inicial";
import { AuditoriaYConsentimiento1792962300589 } from "./1792962300589-AuditoriaYConsentimiento";
import { UbicacionYNormativa1792964432925 } from "./1792964432925-UbicacionYNormativa";
import { Modelo3dOpcional1793061559516 } from "./1793061559516-Modelo3dOpcional";
import { EstadoModelo1793150000000 } from "./1793150000000-EstadoModelo";

// Registro explícito de migraciones (en orden). Al generar una nueva con
// `npm run migration:generate -- src/migrations/<Nombre>`, agrégala a esta lista.
export const migraciones: (new () => MigrationInterface)[] = [
    Inicial1792961995584,
    AuditoriaYConsentimiento1792962300589,
    UbicacionYNormativa1792964432925,
    Modelo3dOpcional1793061559516,
    EstadoModelo1793150000000,
];
