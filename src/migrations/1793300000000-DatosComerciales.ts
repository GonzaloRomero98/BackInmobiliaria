import { MigrationInterface, QueryRunner } from "typeorm";

export class DatosComerciales1793300000000 implements MigrationInterface {
    name = 'DatosComerciales1793300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "etapa" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "fecha_entrega" date`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" ADD "tipo_vivienda" character varying(20) NOT NULL DEFAULT 'CASA'`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" ALTER COLUMN "superficie_terreno" DROP NOT NULL`);
        // Antes era un sí/no sin monto: no hay número que conservar, todos quedan en null
        await queryRunner.query(`ALTER TABLE "modelo_casa" ALTER COLUMN "gastos_comunes" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" ALTER COLUMN "gastos_comunes" TYPE integer USING NULL`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" ADD "plano_url" character varying`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" ADD "subsidios" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" ADD "bono" character varying(150)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "modelo_casa" DROP COLUMN "bono"`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" DROP COLUMN "subsidios"`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" DROP COLUMN "plano_url"`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" ALTER COLUMN "gastos_comunes" TYPE boolean USING ("gastos_comunes" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" ALTER COLUMN "gastos_comunes" SET NOT NULL`);
        // Los departamentos sin terreno quedan en 0 para poder restaurar el NOT NULL
        await queryRunner.query(`UPDATE "modelo_casa" SET "superficie_terreno" = 0 WHERE "superficie_terreno" IS NULL`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" ALTER COLUMN "superficie_terreno" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" DROP COLUMN "tipo_vivienda"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "fecha_entrega"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "etapa"`);
    }

}
