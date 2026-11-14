import { MigrationInterface, QueryRunner } from "typeorm";

// ISO 27001 A.8.15: cadena de hashes en la auditoría. Cada registro guarda su secuencia, el hash del anterior y su propio hash (SHA-256).
// Si alguien edita o borra un registro saltándose los triggers, la cadena deja de calzar y GET /auditoria/verificar lo detecta.
// El hash lo calcula Postgres en un trigger, y un candado ordena las inserciones que llegan al mismo tiempo.
export class AuditoriaEncadenada1793800000000 implements MigrationInterface {
    name = 'AuditoriaEncadenada1793800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auditoria" ADD "secuencia" bigint, ADD "hash_anterior" character varying(64), ADD "hash" character varying(64)`);

        await queryRunner.query(`
            CREATE FUNCTION auditoria_hash(auditoria) RETURNS text LANGUAGE sql STABLE AS $$
                SELECT encode(sha256(convert_to(concat_ws('|',
                    quote_nullable(($1).secuencia), quote_nullable(($1).id),
                    quote_nullable(to_char(($1).fecha, 'YYYY-MM-DD"T"HH24:MI:SS.US')),
                    quote_nullable(($1).accion), quote_nullable(($1).metodo), quote_nullable(($1).ruta),
                    quote_nullable(($1).estado), quote_nullable(($1).exito), quote_nullable(($1).id_usuario),
                    quote_nullable(($1).correo), quote_nullable(($1).rol), quote_nullable(($1).ip),
                    quote_nullable(($1).detalle), quote_nullable(($1).hash_anterior)
                ), 'UTF8')), 'hex')
            $$`);

        // Se encadenan los registros que ya existen. El trigger de solo inserción se apaga solo durante esta migración.
        await queryRunner.query(`ALTER TABLE "auditoria" DISABLE TRIGGER auditoria_sin_cambios`);
        await queryRunner.query(`
            DO $$
            DECLARE r record; n bigint := 0; anterior text;
            BEGIN
                FOR r IN SELECT id FROM auditoria ORDER BY fecha, id LOOP
                    n := n + 1;
                    UPDATE auditoria SET secuencia = n, hash_anterior = anterior WHERE id = r.id;
                    UPDATE auditoria a SET hash = auditoria_hash(a) WHERE a.id = r.id RETURNING a.hash INTO anterior;
                END LOOP;
            END $$`);
        await queryRunner.query(`ALTER TABLE "auditoria" ENABLE TRIGGER auditoria_sin_cambios`);

        await queryRunner.query(`ALTER TABLE "auditoria" ALTER COLUMN "secuencia" SET NOT NULL, ALTER COLUMN "hash" SET NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_auditoria_secuencia" ON "auditoria" ("secuencia")`);

        await queryRunner.query(`
            CREATE FUNCTION auditoria_encadenar() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE ultimo record;
            BEGIN
                -- Candado hasta el fin de la transacción: la siguiente inserción espera y ve este registro ya confirmado
                PERFORM pg_advisory_xact_lock(hashtext('auditoria_cadena'));
                SELECT secuencia, hash INTO ultimo FROM auditoria ORDER BY secuencia DESC LIMIT 1;
                NEW.secuencia := coalesce(ultimo.secuencia, 0) + 1;
                NEW.hash_anterior := ultimo.hash;
                NEW.hash := auditoria_hash(NEW);
                RETURN NEW;
            END $$`);
        await queryRunner.query(`CREATE TRIGGER auditoria_encadenar BEFORE INSERT ON "auditoria" FOR EACH ROW EXECUTE FUNCTION auditoria_encadenar()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER auditoria_encadenar ON "auditoria"`);
        await queryRunner.query(`DROP FUNCTION auditoria_encadenar()`);
        await queryRunner.query(`DROP FUNCTION auditoria_hash(auditoria)`);
        await queryRunner.query(`DROP INDEX "IDX_auditoria_secuencia"`);
        await queryRunner.query(`ALTER TABLE "auditoria" DROP COLUMN "hash", DROP COLUMN "hash_anterior", DROP COLUMN "secuencia"`);
    }

}
