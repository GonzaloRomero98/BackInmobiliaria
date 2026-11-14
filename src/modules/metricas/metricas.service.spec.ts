import { Repository } from 'typeorm';
import { inicioSemana, MetricasService } from './metricas.service';
import { ModeloCasa } from '../modeloCasa/entities/modeloCasa.entity';
import { Solicitud } from '../solicitud/entities/solicitud.entity';
import { Proyecto } from '../proyecto/entities/proyecto.entity';
import { Reserva } from '../reserva/entities/reserva.entity';
import { EventoModelo, TipoEventoModelo } from './entities/eventoModelo.entity';

// Jueves 12 de noviembre de 2026 a las 15:00. Su semana empieza el lunes 9.
const AHORA = new Date(2026, 10, 12, 15, 0);

describe('MetricasService', () => {
  function constructorQb(metodos: string[], final: Record<string, jest.Mock>) {
    const qb: Record<string, jest.Mock> = { ...final };
    for (const m of metodos) qb[m] = jest.fn(() => qb);
    return qb;
  }

  function servicio(unidades: Record<string, string | null>) {
    const encadenables = ['innerJoin', 'select', 'addSelect', 'where', 'groupBy', 'addGroupBy', 'orderBy', 'limit'];
    const qbSemanas = constructorQb(encadenables, { getRawMany: jest.fn().mockResolvedValue([
      { semana: new Date(2026, 10, 9), solicitudes: '4' }, { semana: new Date(2026, 9, 26), solicitudes: '2' },
    ]) });
    const qbTop = constructorQb(encadenables, { getRawMany: jest.fn().mockResolvedValue([{ id: 'm1', nombreModelo: 'Casa A', proyecto: 'Los Robles', solicitudes: '7' }]) });
    const qbUnidades = constructorQb(['select', 'addSelect', 'where'], { getRawOne: jest.fn().mockResolvedValue(unidades) });

    const solicitudes = {
      count: jest.fn(async (o?: { where?: object }) => (o?.where ? 2 : 10)),
      findAndCount: jest.fn(async ({ where }) => where.contactado === false
        ? [[{ id: 'p1', nombre: 'Luis', apellido: 'Soto', celular: '+56911111111', creadoEn: new Date(2026, 10, 2), visitaPreferida: null, modeloCasa: { nombreModelo: 'Cordillera', proyecto: { nombre: 'Vista Andes' } } }], 4]
        : [[{ id: 's1', nombre: 'Ana', apellido: 'Pérez', visitaPreferida: new Date(2026, 10, 13, 11), modeloCasa: { nombreModelo: 'Aurora', proyecto: { nombre: 'Los Robles' } } }], 3]),
      createQueryBuilder: jest.fn().mockReturnValueOnce(qbSemanas).mockReturnValueOnce(qbTop),
    };
    const modelos = {
      count: jest.fn(async ({ where }) => (where.activo === false ? 3 : 4)),
      createQueryBuilder: jest.fn(() => qbUnidades),
      exists: jest.fn(async ({ where }) => where.id === 'publicado'),
    };
    const eventos = {
      count: jest.fn(async ({ where }) => (where.tipo === TipoEventoModelo.QR_ESCANEADO ? 9 : 4)),
      save: jest.fn(),
    };
    const proyectos = { count: jest.fn().mockResolvedValue(5) };
    const reservas = {
      count: jest.fn(async ({ where }) => (where.estado ? 1 : 6)),
      findAndCount: jest.fn().mockResolvedValue([[
        { id: 'r1', lote: 'Lote 4', creadoEn: new Date(2026, 10, 1), solicitud: { id: 's9', nombre: 'Eva', apellido: 'Díaz', modeloCasa: { nombreModelo: 'Aurora', proyecto: { nombre: 'Los Robles' } } } },
      ], 2]),
    };

    return {
      qbUnidades, qbSemanas, solicitudes, reservas, modelos, eventos,
      service: new MetricasService(
        modelos as unknown as Repository<ModeloCasa>,
        solicitudes as unknown as Repository<Solicitud>,
        proyectos as unknown as Repository<Proyecto>,
        reservas as unknown as Repository<Reserva>,
        eventos as unknown as Repository<EventoModelo>,
      ),
    };
  }

  it('arma el resumen, cuenta casas de modelos activos y convierte a número lo que entrega Postgres', async () => {
    const { service, qbUnidades } = servicio({ unidades: '10', reservados: '3', vendidos: '2' });
    const r = await service.resumen(AHORA);

    expect(r).toMatchObject({
      solicitudes: { total: 10, pendientes: 2, ultimos30Dias: 2, previos30Dias: 2 },
      modelos: { publicados: 4, borradores: 3, unidades: 10, disponibles: 5, reservados: 3, vendidos: 2 },
      proyectosActivos: 5,
      reservas: { reservasMes: 6, ventasMes: 1 },
      masSolicitados: [{ id: 'm1', nombreModelo: 'Casa A', proyecto: 'Los Robles', solicitudes: 7 }],
      experiencia3d: { escaneosQr: 9, sesionesAr: 4 },
    });
    expect(qbUnidades.where).toHaveBeenCalledWith('m.activo = true');
  });

  it('experiencia 3D: cuenta escaneos de QR y sesiones de RA de los últimos 30 días', async () => {
    const { service, eventos } = servicio({ unidades: '0', reservados: '0', vendidos: '0' });
    await service.resumen(AHORA);
    const hace30Dias = new Date(AHORA.getTime() - 30 * 24 * 60 * 60 * 1000);
    for (const tipo of [TipoEventoModelo.QR_ESCANEADO, TipoEventoModelo.AR_INICIADA]) {
      expect(eventos.count).toHaveBeenCalledWith({ where: { tipo, creadoEn: expect.objectContaining({ _value: hace30Dias }) } });
    }
  });

  it('registrarEvento guarda el evento de un modelo publicado', async () => {
    const { service, eventos, modelos } = servicio({ unidades: '0', reservados: '0', vendidos: '0' });
    await service.registrarEvento({ id_modelo_casa: 'publicado', tipo: TipoEventoModelo.AR_INICIADA });
    expect(modelos.exists).toHaveBeenCalledWith({ where: { id: 'publicado', activo: true } });
    expect(eventos.save).toHaveBeenCalledWith({ tipo: 'AR_INICIADA', modeloCasa: { id: 'publicado' } });
  });

  it('registrarEvento de un modelo inexistente o en borrador: 404 y no guarda', async () => {
    const { service, eventos } = servicio({ unidades: '0', reservados: '0', vendidos: '0' });
    await expect(service.registrarEvento({ id_modelo_casa: 'borrador', tipo: TipoEventoModelo.QR_ESCANEADO }))
      .rejects.toThrow('Modelo no encontrado');
    expect(eventos.save).not.toHaveBeenCalled();
  });

  it('próximas visitas: hasta 5 en los próximos 7 días, con el total', async () => {
    const { service, solicitudes } = servicio({ unidades: '0', reservados: '0', vendidos: '0' });
    const r = await service.resumen(AHORA);
    expect(r.visitas).toEqual({
      proximos7Dias: 3,
      proximas: [{ id: 's1', nombre: 'Ana', apellido: 'Pérez', visitaPreferida: new Date(2026, 10, 13, 11), modelo: 'Aurora', proyecto: 'Los Robles' }],
    });
    expect(solicitudes.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 5, order: { visitaPreferida: 'ASC' } }));
  });

  it('solicitudes por semana: siempre 8 semanas de lunes a lunes, con 0 en las vacías', async () => {
    const { service, qbSemanas } = servicio({ unidades: '0', reservados: '0', vendidos: '0' });
    const { porSemana } = (await service.resumen(AHORA)).solicitudes;
    expect(porSemana).toHaveLength(8);
    expect(porSemana[0]).toEqual({ semana: '2026-09-21', solicitudes: 0 });
    expect(porSemana[5]).toEqual({ semana: '2026-10-26', solicitudes: 2 });
    expect(porSemana[7]).toEqual({ semana: '2026-11-09', solicitudes: 4 });
    expect(qbSemanas.where).toHaveBeenCalledWith('s.creadoEn >= :desde', { desde: new Date(2026, 8, 21) });
  });

  it('sin modelos activos devuelve ceros (SUM entrega null)', async () => {
    const { service } = servicio({ unidades: null, reservados: null, vendidos: null });
    expect((await service.resumen(AHORA)).modelos).toMatchObject({ unidades: 0, disponibles: 0, reservados: 0, vendidos: 0 });
  });

  it('seguimiento (panel de la secretaria): por contactar las más antiguas primero, agenda y reservas por cerrar', async () => {
    const { service, solicitudes, reservas } = servicio({ unidades: '0', reservados: '0', vendidos: '0' });
    const r = await service.seguimiento(AHORA);
    expect(r).toEqual({
      solicitudes: {
        pendientes: 4, nuevasHoy: 2, nuevasSemana: 2,
        porContactar: [{ id: 'p1', nombre: 'Luis', apellido: 'Soto', celular: '+56911111111', creadoEn: new Date(2026, 10, 2), visitaPreferida: null, modelo: 'Cordillera', proyecto: 'Vista Andes' }],
      },
      visitas: { proximos7Dias: 3, proximas: [expect.objectContaining({ id: 's1', modelo: 'Aurora' })] },
      reservas: {
        enCurso: 2, ventasMes: 1,
        porCerrar: [{ id: 'r1', idSolicitud: 's9', nombre: 'Eva', apellido: 'Díaz', lote: 'Lote 4', creadoEn: new Date(2026, 10, 1), modelo: 'Aurora', proyecto: 'Los Robles' }],
      },
    });
    expect(solicitudes.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { contactado: false }, order: { creadoEn: 'ASC' }, take: 5 }));
    expect(solicitudes.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 8, order: { visitaPreferida: 'ASC' } }));
    expect(reservas.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { estado: 'RESERVADA' }, order: { creadoEn: 'ASC' } }));
    expect(solicitudes.count).toHaveBeenCalledWith({ where: { creadoEn: expect.objectContaining({ _value: new Date(2026, 10, 12) }) } });
  });

  it('inicioSemana: lunes 00:00, también si el día ya es lunes o domingo', () => {
    expect(inicioSemana(new Date(2026, 10, 12, 15))).toEqual(new Date(2026, 10, 9));
    expect(inicioSemana(new Date(2026, 10, 9, 0, 1))).toEqual(new Date(2026, 10, 9));
    expect(inicioSemana(new Date(2026, 10, 15, 23))).toEqual(new Date(2026, 10, 9));
  });
});
