import { MigrationInterface, QueryRunner } from "typeorm";

// Lista de tokens cerrados con "Cerrar sesión" (ISO 27001 A.8.5). Cada fila se borra cuando el token habría vencido.
export class SesionesCerradas1794200000000 implements MigrationInterface {
    name = 'SesionesCerradas1794200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "sesion_cerrada" ("jti" uuid NOT NULL, "vence_en" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_sesion_cerrada" PRIMARY KEY ("jti"))`);
        await queryRunner.query(`CREATE INDEX "IDX_sesion_cerrada_vence_en" ON "sesion_cerrada" ("vence_en")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "sesion_cerrada"`);
    }
}
