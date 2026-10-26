import { MigrationInterface, QueryRunner } from "typeorm";

export class Inicial1792961995584 implements MigrationInterface {
    name = 'Inicial1792961995584'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Las BD creadas antes con `synchronize` ya tienen este esquema: solo se registra la migración.
        if (await queryRunner.hasTable("usuario")) {
            return;
        }

        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "caracteristica" ("id" SERIAL NOT NULL, "nombre" character varying(150) NOT NULL, CONSTRAINT "UQ_3a780ea6da3cd16149f2bbd9386" UNIQUE ("nombre"), CONSTRAINT "PK_dd5a97e77e6d92a70283926eb95" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "region" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, CONSTRAINT "UQ_247715a8e3eeacdf11794ecb722" UNIQUE ("nombre"), CONSTRAINT "PK_5f48ffc3af96bc486f5f3f3a6da" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ciudad" ("id" SERIAL NOT NULL, "nombre" character varying NOT NULL, "id_region" integer NOT NULL, CONSTRAINT "UQ_d2c61478ad47a3fc12a1e4d0fec" UNIQUE ("nombre"), CONSTRAINT "PK_cef4e65aef46bbb8598e284d5d3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "proyecto" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(150) NOT NULL, "descripcion" text NOT NULL, "imagen_portada" character varying, "activo" boolean NOT NULL DEFAULT true, "creado_en" TIMESTAMP NOT NULL DEFAULT now(), "id_ciudad" integer NOT NULL, CONSTRAINT "PK_589bf061fd654da7076e68e1699" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "modelo_casa" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre_modelo" character varying(150) NOT NULL, "tipo_operacion" character varying(20) NOT NULL, "dormitorios" integer NOT NULL, "banos" integer NOT NULL, "estacionamientos" integer NOT NULL DEFAULT '0', "mascotas" boolean NOT NULL DEFAULT false, "superficie_construida" numeric NOT NULL, "superficie_terreno" numeric NOT NULL, "precio" numeric(12,4) NOT NULL, "moneda" character varying(3) NOT NULL, "gastos_comunes" boolean NOT NULL, "modelo_3d_url" character varying NOT NULL, "img_principal" character varying NOT NULL, "activo" boolean NOT NULL DEFAULT true, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), "id_proyecto" uuid NOT NULL, CONSTRAINT "PK_298bff3421221ecb23100aac777" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "galeria_modelo_casa" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "url_imagen" character varying NOT NULL, "orden" integer NOT NULL DEFAULT '0', "id_modelo_casa" uuid NOT NULL, CONSTRAINT "PK_aaa258e586ef5ac11c3d82be973" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rol" ("id" SERIAL NOT NULL, "nombre" character varying(50) NOT NULL, CONSTRAINT "UQ_9792c580a992d554ee1621c5b45" UNIQUE ("nombre"), CONSTRAINT "PK_c93a22388638fac311781c7f2dd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "solicitud" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(200) NOT NULL, "apellido" character varying(200) NOT NULL, "correo" character varying NOT NULL, "celular" character varying(20) NOT NULL, "mensjae" text, "contactado" boolean NOT NULL DEFAULT false, "creado_en" TIMESTAMP NOT NULL DEFAULT now(), "id_modelo_casa" uuid NOT NULL, CONSTRAINT "PK_511b9da509891c4d75633b5079c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "usuario" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "correo" character varying NOT NULL, "contrasena" character varying NOT NULL, "nombre" character varying NOT NULL, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), "activo" boolean NOT NULL DEFAULT true, "id_rol" integer NOT NULL, CONSTRAINT "UQ_349ecb64acc4355db443ca17cbd" UNIQUE ("correo"), CONSTRAINT "PK_a56c58e5cabaa04fb2c98d2d7e2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "modelo_caracteristica" ("id_modelo_casa" uuid NOT NULL, "id_caracteristica" integer NOT NULL, CONSTRAINT "PK_d2152295a49635b02f09128ed2d" PRIMARY KEY ("id_modelo_casa", "id_caracteristica"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e1184b130ded6c53b74ee6e187" ON "modelo_caracteristica"  ("id_modelo_casa") `);
        await queryRunner.query(`CREATE INDEX "IDX_92ca9c9c50b6399a7b53e5a095" ON "modelo_caracteristica"  ("id_caracteristica") `);
        await queryRunner.query(`ALTER TABLE "ciudad" ADD CONSTRAINT "FK_96a7a3a5a456a55a243ab98984f" FOREIGN KEY ("id_region") REFERENCES "region"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "proyecto" ADD CONSTRAINT "FK_0b4042479fb792b6557fa2654ad" FOREIGN KEY ("id_ciudad") REFERENCES "ciudad"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" ADD CONSTRAINT "FK_c3f0fda8785858d8d38d02d1fa0" FOREIGN KEY ("id_proyecto") REFERENCES "proyecto"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "galeria_modelo_casa" ADD CONSTRAINT "FK_b3c141869364062ff03a2873869" FOREIGN KEY ("id_modelo_casa") REFERENCES "modelo_casa"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "solicitud" ADD CONSTRAINT "FK_00086f76b225e4721bf1b969a94" FOREIGN KEY ("id_modelo_casa") REFERENCES "modelo_casa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "usuario" ADD CONSTRAINT "FK_3628e9894c4b014d61a01cb21dd" FOREIGN KEY ("id_rol") REFERENCES "rol"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "modelo_caracteristica" ADD CONSTRAINT "FK_e1184b130ded6c53b74ee6e1870" FOREIGN KEY ("id_modelo_casa") REFERENCES "modelo_casa"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "modelo_caracteristica" ADD CONSTRAINT "FK_92ca9c9c50b6399a7b53e5a0952" FOREIGN KEY ("id_caracteristica") REFERENCES "caracteristica"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "modelo_caracteristica" DROP CONSTRAINT "FK_92ca9c9c50b6399a7b53e5a0952"`);
        await queryRunner.query(`ALTER TABLE "modelo_caracteristica" DROP CONSTRAINT "FK_e1184b130ded6c53b74ee6e1870"`);
        await queryRunner.query(`ALTER TABLE "usuario" DROP CONSTRAINT "FK_3628e9894c4b014d61a01cb21dd"`);
        await queryRunner.query(`ALTER TABLE "solicitud" DROP CONSTRAINT "FK_00086f76b225e4721bf1b969a94"`);
        await queryRunner.query(`ALTER TABLE "galeria_modelo_casa" DROP CONSTRAINT "FK_b3c141869364062ff03a2873869"`);
        await queryRunner.query(`ALTER TABLE "modelo_casa" DROP CONSTRAINT "FK_c3f0fda8785858d8d38d02d1fa0"`);
        await queryRunner.query(`ALTER TABLE "proyecto" DROP CONSTRAINT "FK_0b4042479fb792b6557fa2654ad"`);
        await queryRunner.query(`ALTER TABLE "ciudad" DROP CONSTRAINT "FK_96a7a3a5a456a55a243ab98984f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_92ca9c9c50b6399a7b53e5a095"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e1184b130ded6c53b74ee6e187"`);
        await queryRunner.query(`DROP TABLE "modelo_caracteristica"`);
        await queryRunner.query(`DROP TABLE "usuario"`);
        await queryRunner.query(`DROP TABLE "solicitud"`);
        await queryRunner.query(`DROP TABLE "rol"`);
        await queryRunner.query(`DROP TABLE "galeria_modelo_casa"`);
        await queryRunner.query(`DROP TABLE "modelo_casa"`);
        await queryRunner.query(`DROP TABLE "proyecto"`);
        await queryRunner.query(`DROP TABLE "ciudad"`);
        await queryRunner.query(`DROP TABLE "region"`);
        await queryRunner.query(`DROP TABLE "caracteristica"`);
    }

}
