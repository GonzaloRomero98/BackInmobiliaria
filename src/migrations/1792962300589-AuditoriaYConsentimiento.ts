import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditoriaYConsentimiento1792962300589 implements MigrationInterface {
    name = 'AuditoriaYConsentimiento1792962300589'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "auditoria" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fecha" TIMESTAMP NOT NULL DEFAULT now(), "accion" character varying(100) NOT NULL, "metodo" character varying(10), "ruta" character varying(300), "estado" integer, "exito" boolean NOT NULL, "id_usuario" uuid, "correo" character varying, "rol" character varying(50), "ip" character varying(64), "detalle" jsonb, CONSTRAINT "PK_135fe98308816fe3a2d458e6637" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b92ed16d3033415d97c5113d0d" ON "auditoria"  ("fecha") `);
        await queryRunner.query(`ALTER TABLE "solicitud" ADD "consentimiento_en" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "solicitud" DROP COLUMN "consentimiento_en"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b92ed16d3033415d97c5113d0d"`);
        await queryRunner.query(`DROP TABLE "auditoria"`);
    }

}
