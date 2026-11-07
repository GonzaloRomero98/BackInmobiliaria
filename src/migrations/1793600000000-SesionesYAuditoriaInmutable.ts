import { MigrationInterface, QueryRunner } from "typeorm";

// ISO 27001 A.5.17: fecha del último cambio de contraseña (invalida los tokens anteriores).
// ISO 27001 A.8.15: la auditoría es de solo inserción; nadie (ni la propia API) puede editarla ni borrarla.
export class SesionesYAuditoriaInmutable1793600000000 implements MigrationInterface {
    name = 'SesionesYAuditoriaInmutable1793600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuario" ADD "contrasena_cambiada_en" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`
            CREATE FUNCTION auditoria_solo_insercion() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'La tabla auditoria es de solo inserción (% bloqueado)', TG_OP;
            END;
            $$ LANGUAGE plpgsql`);
        await queryRunner.query(`CREATE TRIGGER auditoria_sin_cambios BEFORE UPDATE OR DELETE ON "auditoria" FOR EACH ROW EXECUTE FUNCTION auditoria_solo_insercion()`);
        await queryRunner.query(`CREATE TRIGGER auditoria_sin_truncate BEFORE TRUNCATE ON "auditoria" FOR EACH STATEMENT EXECUTE FUNCTION auditoria_solo_insercion()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER auditoria_sin_truncate ON "auditoria"`);
        await queryRunner.query(`DROP TRIGGER auditoria_sin_cambios ON "auditoria"`);
        await queryRunner.query(`DROP FUNCTION auditoria_solo_insercion()`);
        await queryRunner.query(`ALTER TABLE "usuario" DROP COLUMN "contrasena_cambiada_en"`);
    }

}
