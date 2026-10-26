import { MigrationInterface, QueryRunner } from "typeorm";

export class UbicacionYNormativa1792964432925 implements MigrationInterface {
    name = 'UbicacionYNormativa1792964432925'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "normativa_proyecto" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "instrumento" character varying(200) NOT NULL, "zona" character varying(50) NOT NULL, "usos_permitidos" text NOT NULL, "altura_maxima_metros" numeric(6,2), "altura_maxima_pisos" integer, "densidad_maxima" integer, "coef_constructibilidad" numeric(5,2), "coef_ocupacion_suelo" numeric(4,2), "riesgos" text array NOT NULL DEFAULT '{}', "url_ordenanza" character varying, "fecha_consulta" date NOT NULL, "observaciones" text, "actualizado_en" TIMESTAMP NOT NULL DEFAULT now(), "id_proyecto" uuid NOT NULL, CONSTRAINT "REL_3ce7e9ca4333e3101cadf71a51" UNIQUE ("id_proyecto"), CONSTRAINT "PK_f87e08f5b443b29ce8295af3b09" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "direccion" character varying(200)`);
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "latitud" numeric(9,6)`);
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "longitud" numeric(9,6)`);
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "entorno" jsonb`);
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "entorno_actualizado_en" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "normativa_proyecto" ADD CONSTRAINT "FK_3ce7e9ca4333e3101cadf71a51f" FOREIGN KEY ("id_proyecto") REFERENCES "proyecto"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "normativa_proyecto" DROP CONSTRAINT "FK_3ce7e9ca4333e3101cadf71a51f"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "entorno_actualizado_en"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "entorno"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "longitud"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "latitud"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "direccion"`);
        await queryRunner.query(`DROP TABLE "normativa_proyecto"`);
    }

}
