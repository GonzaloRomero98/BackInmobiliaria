import { MigrationInterface, QueryRunner } from "typeorm";

// Retención de la auditoría (ISO 27701, Ley 21.719: limitación del plazo). Guarda correos del personal e IP de
// visitantes, así que se conserva 2 años y luego se borra. El plazo está fijo aquí, no en el .env: para acortarlo hay
// que escribir una migración, y el trigger sigue rechazando cualquier DELETE de un registro más nuevo (ni la API puede).
export class RetencionAuditoria1794100000000 implements MigrationInterface {
    name = 'RetencionAuditoria1794100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE FUNCTION auditoria_retencion_limite() RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT now() - interval '2 years' $$`);
        // IF anidado: en el trigger de TRUNCATE (por sentencia) OLD no existe
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION auditoria_solo_insercion() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    IF OLD.fecha < auditoria_retencion_limite() THEN
                        RETURN OLD;
                    END IF;
                END IF;
                RAISE EXCEPTION 'La tabla auditoria es de solo inserción (% bloqueado)', TG_OP;
            END;
            $$ LANGUAGE plpgsql`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION auditoria_solo_insercion() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'La tabla auditoria es de solo inserción (% bloqueado)', TG_OP;
            END;
            $$ LANGUAGE plpgsql`);
        await queryRunner.query(`DROP FUNCTION auditoria_retencion_limite()`);
    }
}
