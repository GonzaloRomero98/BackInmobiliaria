import { MigrationInterface, QueryRunner } from "typeorm";

export class FotoPerfil1793400000000 implements MigrationInterface {
    name = 'FotoPerfil1793400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuario" ADD "foto_url" character varying(500)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuario" DROP COLUMN "foto_url"`);
    }

}
