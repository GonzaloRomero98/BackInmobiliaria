import { MigrationInterface, QueryRunner } from "typeorm";

// Corrige el typo de solicitud.mensjae, agrega restricciones CHECK con los valores que el código ya valida
// (así un dato inválido no entra por una consulta directa) e índices en las llaves foráneas más consultadas.
const CHECKS = [
    {nombre:'CK_solicitud_origen', tabla:'solicitud', condicion:`"origen" IN ('WEB','SALA_VENTAS','TELEFONO','WHATSAPP')`},
    {nombre:'CK_solicitud_visita_estado', tabla:'solicitud', condicion:`"visita_estado" IS NULL OR "visita_estado" IN ('POR_CONFIRMAR','CONFIRMADA','ASISTIO','NO_ASISTIO')`},
    {nombre:'CK_modelo_casa_tipo_operacion', tabla:'modelo_casa', condicion:`"tipo_operacion" IN ('VENTA','ARRIENDO')`},
    {nombre:'CK_modelo_casa_moneda', tabla:'modelo_casa', condicion:`"moneda" IN ('UF','CLP')`},
    {nombre:'CK_modelo_casa_tipo_vivienda', tabla:'modelo_casa', condicion:`"tipo_vivienda" IN ('CASA','DEPARTAMENTO')`},
    {nombre:'CK_modelo_casa_precio', tabla:'modelo_casa', condicion:`"precio" >= 0`},
    {nombre:'CK_reserva_estado', tabla:'reserva', condicion:`"estado" IN ('RESERVADA','VENDIDA','ANULADA')`},
];

// Solo las llaves que se usan para filtrar o unir con frecuencia; las de usuario.id_rol y los autores de notas y cotizaciones casi no se consultan.
const INDICES = [
    {nombre:'IDX_ciudad_region', tabla:'ciudad', columna:'id_region'},
    {nombre:'IDX_proyecto_ciudad', tabla:'proyecto', columna:'id_ciudad'},
    {nombre:'IDX_modelo_casa_proyecto', tabla:'modelo_casa', columna:'id_proyecto'},
    {nombre:'IDX_galeria_modelo_casa_modelo', tabla:'galeria_modelo_casa', columna:'id_modelo_casa'},
    {nombre:'IDX_solicitud_modelo_casa', tabla:'solicitud', columna:'id_modelo_casa'},
    {nombre:'IDX_evento_modelo_modelo', tabla:'evento_modelo', columna:'id_modelo_casa'},
];

export class RestriccionesEIndices1794600000000 implements MigrationInterface {
    name = 'RestriccionesEIndices1794600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Si hay filas que no cumplen, el ALTER fallaría con un error genérico; aquí se avisa cuál restricción y cuántas filas.
        // No se muestran los valores porque pueden ser datos personales y esto queda en el log.
        for(const {nombre, tabla, condicion} of CHECKS){
            const [{total}] = await queryRunner.query(`SELECT count(*)::int AS total FROM "${tabla}" WHERE NOT (${condicion})`);
            if(total > 0){
                throw new Error(`${tabla} tiene ${total} fila(s) que no cumplen ${nombre} (${condicion}). Corrígelas antes de migrar. `
                    + `Para verlas: SELECT * FROM "${tabla}" WHERE NOT (${condicion})`);
            }
        }
        await queryRunner.query(`ALTER TABLE "solicitud" RENAME COLUMN "mensjae" TO "mensaje"`);
        for(const {nombre, tabla, condicion} of CHECKS){
            await queryRunner.query(`ALTER TABLE "${tabla}" ADD CONSTRAINT "${nombre}" CHECK (${condicion})`);
        }
        for(const {nombre, tabla, columna} of INDICES){
            await queryRunner.query(`CREATE INDEX "${nombre}" ON "${tabla}" ("${columna}")`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for(const {nombre} of INDICES){
            await queryRunner.query(`DROP INDEX "${nombre}"`);
        }
        for(const {nombre, tabla} of CHECKS){
            await queryRunner.query(`ALTER TABLE "${tabla}" DROP CONSTRAINT "${nombre}"`);
        }
        await queryRunner.query(`ALTER TABLE "solicitud" RENAME COLUMN "mensaje" TO "mensjae"`);
    }
}
