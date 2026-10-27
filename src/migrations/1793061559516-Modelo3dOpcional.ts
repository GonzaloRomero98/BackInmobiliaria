import { MigrationInterface, QueryRunner } from "typeorm";

export class Modelo3dOpcional1793061559516 implements MigrationInterface {
    name = 'Modelo3dOpcional1793061559516'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "modelo_casa" ALTER COLUMN "modelo_3d_url" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "modelo_casa" ALTER COLUMN "modelo_3d_url" SET NOT NULL`);
    }

}
