import { MigrationInterface, QueryRunner } from "typeorm";

// Los estados manuales previos eran datos de prueba: todo modelo queda con 1 unidad y DISPONIBLE
export class UnidadesYReservas1793700000000 implements MigrationInterface {
    name = 'UnidadesYReservas1793700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "modelo_casa" ADD "unidades" integer NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" ADD "unidades_reservadas" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" ADD "unidades_vendidas" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`CREATE TABLE "reserva" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rut" character varying(12) NOT NULL, "lote" character varying(50), "estado" character varying(20) NOT NULL DEFAULT 'RESERVADA', "creado_en" TIMESTAMP NOT NULL DEFAULT now(), "actualizado_en" TIMESTAMP NOT NULL DEFAULT now(), "id_solicitud" uuid NOT NULL, CONSTRAINT "PK_reserva" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_reserva_solicitud" ON "reserva" ("id_solicitud")`);
        await queryRunner.query(`ALTER TABLE "reserva" ADD CONSTRAINT "FK_reserva_solicitud" FOREIGN KEY ("id_solicitud") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`UPDATE "modelo_casa" SET "estado" = 'DISPONIBLE'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reserva" DROP CONSTRAINT "FK_reserva_solicitud"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_reserva_solicitud"`);
        await queryRunner.query(`DROP TABLE "reserva"`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" DROP COLUMN "unidades_vendidas"`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" DROP COLUMN "unidades_reservadas"`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" DROP COLUMN "unidades"`);
    }

}
