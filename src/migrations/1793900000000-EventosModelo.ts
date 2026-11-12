import { MigrationInterface, QueryRunner } from "typeorm";

export class EventosModelo1793900000000 implements MigrationInterface {
    name = 'EventosModelo1793900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "evento_modelo" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipo" character varying(20) NOT NULL, "creado_en" TIMESTAMP NOT NULL DEFAULT now(), "id_modelo_casa" uuid NOT NULL, CONSTRAINT "PK_evento_modelo" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_evento_modelo_creado" ON "evento_modelo" ("creado_en")`);
        await queryRunner.query(`ALTER TABLE "evento_modelo" ADD CONSTRAINT "FK_evento_modelo_modelo" FOREIGN KEY ("id_modelo_casa") REFERENCES "modelo_casa"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "evento_modelo" DROP CONSTRAINT "FK_evento_modelo_modelo"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_evento_modelo_creado"`);
        await queryRunner.query(`DROP TABLE "evento_modelo"`);
    }
}
