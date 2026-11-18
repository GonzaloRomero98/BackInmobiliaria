import { MigrationInterface, QueryRunner } from "typeorm";

// Horario de la sala por día, para ofrecer solo horas en que atiende. Las salas existentes quedan en null
// hasta que el admin cargue su horario; mientras tanto la visita no se restringe por horario.
export class HorariosSala1794400000000 implements MigrationInterface {
    name = 'HorariosSala1794400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "proyecto" ADD "sala_horarios" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "proyecto" DROP COLUMN "sala_horarios"`);
    }
}
