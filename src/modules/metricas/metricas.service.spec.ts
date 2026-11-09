import { Repository } from 'typeorm';
import { MetricasService } from './metricas.service';
import { ModeloCasa } from '../modeloCasa/entities/modeloCasa.entity';
import { Solicitud } from '../solicitud/entities/solicitud.entity';
import { Proyecto } from '../proyecto/entities/proyecto.entity';

describe('MetricasService', () => {
  function servicio(unidades: Record<string, string | null>) {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['innerJoin', 'select', 'addSelect', 'groupBy', 'orderBy', 'limit', 'where']) qb[m] = jest.fn(() => qb);
    qb.getRawMany = jest.fn().mockResolvedValue([{ id: 'm1', nombreModelo: 'Casa A', solicitudes: '7' }]);
    const qbUnidades: Record<string, jest.Mock> = {};
    for (const m of ['select', 'addSelect', 'where']) qbUnidades[m] = jest.fn(() => qbUnidades);
    qbUnidades.getRawOne = jest.fn().mockResolvedValue(unidades);

    const solicitudes = { count: jest.fn(async (o?: { where?: object }) => (o?.where ? 2 : 10)), createQueryBuilder: jest.fn(() => qb) };
    const modelos = {
      count: jest.fn(async ({ where }) => (where.activo === false ? 3 : 4)),
      createQueryBuilder: jest.fn(() => qbUnidades),
    };
    const proyectos = { count: jest.fn().mockResolvedValue(5) };

    return {
      qbUnidades,
      service: new MetricasService(
        modelos as unknown as Repository<ModeloCasa>,
        solicitudes as unknown as Repository<Solicitud>,
        proyectos as unknown as Repository<Proyecto>,
      ),
    };
  }

  it('arma el resumen, cuenta casas de modelos activos y convierte a número lo que entrega Postgres', async () => {
    const { service, qbUnidades } = servicio({ unidades: '10', reservados: '3', vendidos: '2' });
    const r = await service.resumen();

    expect(r).toEqual({
      solicitudes: { total: 10, pendientes: 2, ultimos30Dias: 2 },
      modelos: { publicados: 4, borradores: 3, unidades: 10, disponibles: 5, reservados: 3, vendidos: 2 },
      proyectosActivos: 5,
      masSolicitados: [{ id: 'm1', nombreModelo: 'Casa A', solicitudes: 7 }],
    });
    expect(qbUnidades.where).toHaveBeenCalledWith('m.activo = true');
  });

  it('sin modelos activos devuelve ceros (SUM entrega null)', async () => {
    const { service } = servicio({ unidades: null, reservados: null, vendidos: null });
    expect((await service.resumen()).modelos).toMatchObject({ unidades: 0, disponibles: 0, reservados: 0, vendidos: 0 });
  });
});
