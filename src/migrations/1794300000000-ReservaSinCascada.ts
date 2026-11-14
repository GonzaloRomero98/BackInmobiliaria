import { MigrationInterface, QueryRunner } from "typeorm";

// Antes, borrar una solicitud borraba en cascada sus reservas. Si justo en ese momento se creaba una reserva,
// se perdía una reserva activa y el contador de unidades del modelo quedaba descuadrado.
// Ahora la BD rechaza el borrado mientras exista una reserva, y el servicio borra antes las anuladas.
export class ReservaSinCascada1794300000000 implements MigrationInterface {
    name = 'ReservaSinCascada1794300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reserva" DROP CONSTRAINT "FK_reserva_solicitud"`);
        await queryRunner.query(`ALTER TABLE "reserva" ADD CONSTRAINT "FK_reserva_solicitud" FOREIGN KEY ("id_solicitud") REFERENCES "solicitud"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reserva" DROP CONSTRAINT "FK_reserva_solicitud"`);
        await queryRunner.query(`ALTER TABLE "reserva" ADD CONSTRAINT "FK_reserva_solicitud" FOREIGN KEY ("id_solicitud") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
}
