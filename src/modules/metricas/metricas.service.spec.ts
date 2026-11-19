import { Repository } from 'typeorm';
import { inicioDia, inicioMes, inicioSemana, MetricasService } from './metricas.service';
import { ModeloCasa } from '../modeloCasa/entities/modeloCasa.entity';
import { Solicitud } from '../solicitud/entities/solicitud.entity';
import { Proyecto } from '../proyecto/entities/proyecto.entity';
import { Reserva } from '../reserva/entities/reserva.entity';
import { EventoModelo, TipoEventoModelo } from './entities/eventoModelo.entity';

// Las fechas van con su desfase de Chile (-03 en verano, -04 en invierno), así el resultado no depende
// de la zona horaria del equipo que corre los tests (el servidor corre en UTC).
const chile = (fechaHora: string) => new Date(fechaHora);

// Jueves 12 de noviembre de 2026 a las 15:00 en Chile. Su semana empieza el lunes 9.
const AHORA = chile('2026-11-12T15:00:00-03:00');

describe('MetricasService', () => {
  function constructorQb(metodos: string[], final: Record<string, jest.Mock>) {
    const qb: Record<string, jest.Mock> = { ...final };
    for (const m of metodos) qb[m] = jest.fn(() => qb);
    return qb;
  }

  function servicio(unidades: Record<string, string | null>) {
    const encadenables = ['innerJoin', 'select', 'addSelect', 'where', 'groupBy', 'addGroupBy', 'orderBy', 'limit'];
    // Solicitudes de las últimas 8 semanas: 4 en la del lunes 9-nov, 2 en la del 26-oct y una el domingo 8-nov
    // a las 23:30 de Chile, que en UTC ya es lunes 9 pero cuenta en la semana del 2-nov.
    const recientes = [
      '2026-11-09T00:00:00-03:00', '2026-11-10T09:00:00-03:00', '2026-11-11T18:00:00-03:00', '2026-11-12T14:59:00-03:00',
      '2026-10-26T10:00:00-03:00', '2026-11-01T23:00:00-03:00',
      '2026-11-08T23:30:00-03:00',
    ].map((f, i) => ({ id: `s${i}`, creadoEn: chile(f) }));
    const qbTop = constructorQb(encadenables, { getRawMany: jest.fn().mockResolvedValue([{ id: 'm1', nombreModelo: 'Casa A', proyecto: 'Los Robles', solicitudes: '7' }]) });
    const qbUnidades = constructorQb(['select', 'addSelect', 'where'], { getRawOne: jest.fn().mockResolvedValue(unidades) });

    const solicitudes = {
      count: jest.fn(async (o?: { where?: object }) => (o?.where ? 2 : 10)),
      findAndCount: jest.fn(async ({ where }) => where.contactado === false
        ? [[{ id: 'p1', nombre: 'Luis', apellido: 'Soto', celular: '+56911111111', creadoEn: new Date(2026, 10, 2), visitaPreferida: null, modeloCasa: { nombreModelo: 'Cordillera', proyecto: { nombre: 'Vista Andes' } } }], 4]
        : [[{ id: 's1', nombre: 'Ana', apellido: 'Pérez', visitaPreferida: new Date(2026, 10, 13, 11), modeloCasa: { nombreModelo: 'Aurora', proyecto: { nombre: 'Los Robles' } } }], 3]),
      find: jest.fn().mockResolvedValue(recientes),
      createQueryBuilder: jest.fn().mockReturnValueOnce(qbTop),
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
      qbUnidades, solicitudes, reservas, modelos, eventos,
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

  it('solicitudes por semana: siempre 8 semanas de lunes a lunes (hora de Chile), con 0 en las vacías', async () => {
    const { service, solicitudes } = servicio({ unidades: '0', reservados: '0', vendidos: '0' });
    const { porSemana } = (await service.resumen(AHORA)).solicitudes;
    expect(porSemana).toHaveLength(8);
    expect(porSemana[0]).toEqual({ semana: '2026-09-21', solicitudes: 0 });
    expect(porSemana[5]).toEqual({ semana: '2026-10-26', solicitudes: 2 });
    expect(porSemana[6]).toEqual({ semana: '2026-11-02', solicitudes: 1 });
    expect(porSemana[7]).toEqual({ semana: '2026-11-09', solicitudes: 4 });
    expect(solicitudes.find).toHaveBeenCalledWith({
      select: { id: true, creadoEn: true },
      where: { creadoEn: expect.objectContaining({ _value: chile('2026-09-21T00:00:00-03:00') }) },
    });
  });

  it('reservas y ventas del mes desde el día 1 a las 00:00 de Chile, aunque en UTC ya sea otro mes', async () => {
    const { service, reservas } = servicio({ unidades: '0', reservados: '0', vendidos: '0' });
    // 30-nov a las 22:00 en Chile = 1-dic 01:00 UTC.
    await service.resumen(chile('2026-11-30T22:00:00-03:00'));
    const inicio = chile('2026-11-01T00:00:00-03:00');
    expect(reservas.count).toHaveBeenCalledWith({ where: { creadoEn: expect.objectContaining({ _value: inicio }) } });
    expect(reservas.count).toHaveBeenCalledWith({ where: { estado: 'VENDIDA', actualizadoEn: expect.objectContaining({ _value: inicio }) } });
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
    expect(solicitudes.count).toHaveBeenCalledWith({ where: { creadoEn: expect.objectContaining({ _value: chile('2026-11-12T00:00:00-03:00') }) } });
    expect(solicitudes.count).toHaveBeenCalledWith({ where: { creadoEn: expect.objectContaining({ _value: chile('2026-11-09T00:00:00-03:00') }) } });
    expect(reservas.count).toHaveBeenCalledWith({ where: { estado: 'VENDIDA', actualizadoEn: expect.objectContaining({ _value: chile('2026-11-01T00:00:00-03:00') }) } });
  });

  it('inicioSemana: lunes 00:00 de Chile, también si el día ya es lunes o domingo', () => {
    expect(inicioSemana(AHORA)).toEqual(chile('2026-11-09T00:00:00-03:00'));
    expect(inicioSemana(chile('2026-11-09T00:01:00-03:00'))).toEqual(chile('2026-11-09T00:00:00-03:00'));
    expect(inicioSemana(chile('2026-11-15T23:00:00-03:00'))).toEqual(chile('2026-11-09T00:00:00-03:00'));
    expect(inicioSemana(AHORA, 7)).toEqual(chile('2026-09-21T00:00:00-03:00'));
  });

  it('inicioDia: a las 23:30 de Chile sigue siendo el mismo día, aunque en UTC ya sea el siguiente', () => {
    expect(inicioDia(chile('2026-11-12T23:30:00-03:00'))).toEqual(chile('2026-11-12T00:00:00-03:00'));
    expect(inicioDia(chile('2026-11-13T00:00:00-03:00'))).toEqual(chile('2026-11-13T00:00:00-03:00'));
  });

  it('cambios de hora: invierno (-04), el día que se adelanta el reloj y una semana que cruza el cambio', () => {
    expect(inicioDia(chile('2026-07-15T10:00:00-04:00'))).toEqual(chile('2026-07-15T00:00:00-04:00'));
    // El domingo 6-sep-2026 el reloj salta de 00:00 a 01:00: el día empieza a la 01:00 (-03).
    expect(inicioDia(chile('2026-09-06T15:00:00-03:00'))).toEqual(chile('2026-09-06T01:00:00-03:00'));
    // El domingo 5-abr-2026 se atrasa el reloj: el lunes 6 ya está en -04.
    expect(inicioSemana(chile('2026-04-08T12:00:00-04:00'))).toEqual(chile('2026-04-06T00:00:00-04:00'));
    expect(inicioSemana(chile('2026-04-08T12:00:00-04:00'), 1)).toEqual(chile('2026-03-30T00:00:00-03:00'));
  });

  it('inicioMes: día 1 a las 00:00 de Chile, también en enero y a fin de mes de noche', () => {
    expect(inicioMes(chile('2026-11-30T22:00:00-03:00'))).toEqual(chile('2026-11-01T00:00:00-03:00'));
    expect(inicioMes(chile('2027-01-01T00:30:00-03:00'))).toEqual(chile('2027-01-01T00:00:00-03:00'));
  });
});
