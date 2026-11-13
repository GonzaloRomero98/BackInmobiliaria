import { MigrationInterface, QueryRunner } from "typeorm";

// Seguimiento de la secretaria: origen de la solicitud, estado de la visita, notas y cotizaciones con folio
export class SeguimientoSolicitudes1794000000000 implements MigrationInterface {
    name = 'SeguimientoSolicitudes1794000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "solicitud" ADD "origen" character varying(20) NOT NULL DEFAULT 'WEB'`);
        await queryRunner.query(`ALTER TABLE "solicitud" ADD "visita_estado" character varying(20)`);
        // Las visitas ya pedidas quedan por confirmar
        await queryRunner.query(`UPDATE "solicitud" SET "visita_estado" = 'POR_CONFIRMAR' WHERE "visita_preferida" IS NOT NULL`);

        await queryRunner.query(`CREATE TABLE "nota_solicitud" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "texto" text NOT NULL, "creado_en" TIMESTAMP NOT NULL DEFAULT now(), "id_solicitud" uuid NOT NULL, "id_usuario" uuid, CONSTRAINT "PK_nota_solicitud" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_nota_solicitud_solicitud" ON "nota_solicitud" ("id_solicitud")`);
        await queryRunner.query(`ALTER TABLE "nota_solicitud" ADD CONSTRAINT "FK_nota_solicitud_solicitud" FOREIGN KEY ("id_solicitud") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "nota_solicitud" ADD CONSTRAINT "FK_nota_solicitud_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "cotizacion" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "folio" SERIAL NOT NULL, "datos" jsonb NOT NULL, "creado_en" TIMESTAMP NOT NULL DEFAULT now(), "id_solicitud" uuid NOT NULL, "id_usuario" uuid, CONSTRAINT "PK_cotizacion" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_cotizacion_folio" ON "cotizacion" ("folio")`);
        await queryRunner.query(`CREATE INDEX "IDX_cotizacion_solicitud" ON "cotizacion" ("id_solicitud")`);
        await queryRunner.query(`ALTER TABLE "cotizacion" ADD CONSTRAINT "FK_cotizacion_solicitud" FOREIGN KEY ("id_solicitud") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cotizacion" ADD CONSTRAINT "FK_cotizacion_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "cotizacion"`);
        await queryRunner.query(`DROP TABLE "nota_solicitud"`);
        await queryRunner.query(`ALTER TABLE "solicitud" DROP COLUMN "visita_estado"`);
        await queryRunner.query(`ALTER TABLE "solicitud" DROP COLUMN "origen"`);
    }
}
