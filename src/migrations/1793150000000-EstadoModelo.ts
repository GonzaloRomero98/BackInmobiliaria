import { MigrationInterface, QueryRunner } from "typeorm";

export class EstadoModelo1793150000000 implements MigrationInterface {
    name = 'EstadoModelo1793150000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "modelo_casa" ADD "estado" character varying(20) NOT NULL DEFAULT 'DISPONIBLE'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "modelo_casa" DROP COLUMN "estado"`);
    }

}
