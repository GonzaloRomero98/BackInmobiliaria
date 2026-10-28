import { Repository } from 'typeorm';
import { MetricasService } from './metricas.service';
import { ModeloCasa } from '../modeloCasa/entities/modeloCasa.entity';
import { Solicitud } from '../solicitud/entities/solicitud.entity';
import { Proyecto } from '../proyecto/entities/proyecto.entity';

describe('MetricasService', () => {
  it('arma el resumen y convierte a número el COUNT de Postgres', async () => {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['innerJoin', 'select', 'addSelect', 'groupBy', 'orderBy', 'limit']) qb[m] = jest.fn(() => qb);
    qb.getRawMany = jest.fn().mockResolvedValue([{ id: 'm1', nombreModelo: 'Casa A', solicitudes: '7' }]);

    const solicitudes = { count: jest.fn(async (o?: { where?: object }) => (o?.where ? 2 : 10)), createQueryBuilder: jest.fn(() => qb) };
    const modelos = { count: jest.fn(async ({ where }) => (where.estado === 'VENDIDO' ? 1 : where.activo === false ? 3 : 4)) };
    const proyectos = { count: jest.fn().mockResolvedValue(5) };

    const r = await new MetricasService(
      modelos as unknown as Repository<ModeloCasa>,
      solicitudes as unknown as Repository<Solicitud>,
      proyectos as unknown as Repository<Proyecto>,
    ).resumen();

    expect(r).toEqual({
      solicitudes: { total: 10, pendientes: 2, ultimos30Dias: 2 },
      modelos: { publicados: 4, borradores: 3, disponibles: 4, reservados: 4, vendidos: 1 },
      proyectosActivos: 5,
      masSolicitados: [{ id: 'm1', nombreModelo: 'Casa A', solicitudes: 7 }],
    });
  });
});
