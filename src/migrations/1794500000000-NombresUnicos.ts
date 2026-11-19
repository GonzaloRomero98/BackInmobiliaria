import { MigrationInterface, QueryRunner } from "typeorm";

// Índices únicos sin distinguir mayúsculas. El servicio ya revisa los duplicados antes de guardar,
// pero dos guardados al mismo tiempo pasaban los dos. Ahora la BD rechaza el segundo (23505 -> 409).
// Las restricciones UNIQUE anteriores de usuario.correo y caracteristica.nombre quedan, pero esto las cubre.
const INDICES = [
    {nombre:'UQ_usuario_correo_lower', tabla:'usuario', columna:'correo'},
    {nombre:'UQ_modelo_casa_nombre_lower', tabla:'modelo_casa', columna:'nombre_modelo'},
    {nombre:'UQ_caracteristica_nombre_lower', tabla:'caracteristica', columna:'nombre'},
];

export class NombresUnicos1794500000000 implements MigrationInterface {
    name = 'NombresUnicos1794500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Si ya hay repetidos, el índice no se puede crear. Se avisa cuáles revisar en vez de fallar con un error de Postgres.
        // No se muestran los valores porque los correos son datos personales y esto queda en el log.
        for(const {tabla, columna} of INDICES){
            const consulta = `SELECT LOWER("${columna}") AS valor, count(*) FROM "${tabla}" GROUP BY 1 HAVING count(*) > 1`;
            const repetidos = await queryRunner.query(consulta);
            if(repetidos.length > 0){
                throw new Error(`${tabla}.${columna} tiene ${repetidos.length} valor(es) repetido(s) sin distinguir mayúsculas. `
                    + `Corrígelos antes de migrar. Para verlos: ${consulta}`);
            }
        }
        for(const {nombre, tabla, columna} of INDICES){
            await queryRunner.query(`CREATE UNIQUE INDEX "${nombre}" ON "${tabla}" (LOWER("${columna}"))`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for(const {nombre} of INDICES){
            await queryRunner.query(`DROP INDEX "${nombre}"`);
        }
    }
}
