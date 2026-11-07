import { MigrationInterface, QueryRunner } from "typeorm";

export class SalaVentasYVisita1793500000000 implements MigrationInterface {
    name = 'SalaVentasYVisita1793500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "sala_direccion" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "sala_horario" character varying(150)`);
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "sala_telefono" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "sala_latitud" numeric(9,6)`);
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "sala_longitud" numeric(9,6)`);
        await queryRunner.query(`ALTER TABLE "solicitud" ADD "visita_preferida" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "solicitud" DROP COLUMN "visita_preferida"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "sala_longitud"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "sala_latitud"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "sala_telefono"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "sala_horario"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "sala_direccion"`);
    }

}
