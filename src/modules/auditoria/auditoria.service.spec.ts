import { And, DataSource, ILike, In, LessThan, Like, MoreThanOrEqual, Repository } from 'typeorm';
import { AuditoriaService } from './auditoria.service';
import { ListarAuditoriaDto } from './dto/listarAuditoria.dto';

const ID = '11111111-1111-4111-8111-111111111111';
const filtros = (f: Partial<ListarAuditoriaDto> = {}) => ({ pagina: 1, limite: 50, soloRechazados: false, ...f }) as ListarAuditoriaDto;

describe('AuditoriaService', () => {
  let auditoriaRepo: { findAndCount: jest.Mock; save: jest.Mock; create: jest.Mock };
  let proyectoRepo: { find: jest.Mock };
  let modeloRepo: { find: jest.Mock };
  let usuarioRepo: { find: jest.Mock };
  let dataSource: { query: jest.Mock };
  let service: AuditoriaService;
  const where = () => auditoriaRepo.findAndCount.mock.calls[0][0].where;

  beforeEach(() => {
    auditoriaRepo = { findAndCount: jest.fn(async () => [[], 0]), save: jest.fn(), create: jest.fn((x) => x) };
    proyectoRepo = { find: jest.fn(async () => [{ id: ID, nombre: 'Los Robles' }]) };
    modeloRepo = { find: jest.fn(async () => []) };
    usuarioRepo = { find: jest.fn(async () => []) };
    dataSource = { query: jest.fn() };
    service = new AuditoriaService(
      auditoriaRepo as unknown as Repository<never>, proyectoRepo as unknown as Repository<never>,
      modeloRepo as unknown as Repository<never>, usuarioRepo as unknown as Repository<never>,
      dataSource as unknown as DataSource,
    );
  });

  describe('listar', () => {
    it('sin filtros: más recientes primero por secuencia, paginado', async () => {
      await service.listar(filtros({ pagina: 3, limite: 20 }));
      expect(auditoriaRepo.findAndCount).toHaveBeenCalledWith({ where: {}, order: { secuencia: 'DESC' }, skip: 40, take: 20 });
    });

    it('correo parcial sin comodines, solo rechazados y rango de fechas', async () => {
      await service.listar(filtros({ correo: 'a_b%', soloRechazados: true, desde: '2026-11-01T03:00:00.000Z', hasta: '2026-11-02T03:00:00.000Z' }));
      expect(where()).toEqual({
        correo: ILike('%a\\_b\\%%'),
        exito: false,
        fecha: And(MoreThanOrEqual(new Date('2026-11-01T03:00:00.000Z')), LessThan(new Date('2026-11-02T03:00:00.000Z'))),
      });
    });

    it('módulo: una condición por prefijo de ruta y otra para sus acciones internas (OR)', async () => {
      await service.listar(filtros({ modulo: 'solicitudes', soloRechazados: true }));
      expect(where()).toEqual([
        { exito: false, ruta: Like('/api/solicitudes%') },
        { exito: false, accion: In(['EXPORTAR_SOLICITUDES', 'RETENCION_SOLICITUDES']) },
      ]);
    });

    it('agrega la descripción con el nombre del recurso, consultando solo los tipos presentes', async () => {
      auditoriaRepo.findAndCount.mockResolvedValue([[
        { id: 'a1', accion: 'x', metodo: 'DELETE', ruta: `/api/proyectos/${ID}`, estado: 200, exito: true, detalle: null },
        { id: 'a2', accion: 'x', metodo: 'GET', ruta: '/api/usuarios', estado: 403, exito: false, detalle: null },
      ], 2]);
      const res = await service.listar(filtros());
      expect(res.registros.map((r) => r.descripcion)).toEqual(['Despublicó el proyecto «Los Robles»', null]);
      expect(proyectoRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: In([ID]) } }));
      expect(modeloRepo.find).not.toHaveBeenCalled();
      expect(usuarioRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('borradoDiario', () => {
    afterEach(() => { delete process.env.AUDITORIA_BORRADO_DIARIO; });

    it('sin AUDITORIA_BORRADO_DIARIO=true no borra nada', async () => {
      (dataSource as unknown as { transaction: jest.Mock }).transaction = jest.fn();
      expect(await service.borradoDiario()).toBe(0);
      expect((dataSource as unknown as { transaction: jest.Mock }).transaction).not.toHaveBeenCalled();
    });

    it('con la variable activa vacía la tabla con el bloqueo apagado solo durante el TRUNCATE y deja constancia', async () => {
      process.env.AUDITORIA_BORRADO_DIARIO = 'true';
      const m = { query: jest.fn(async (sql: string) => (sql.startsWith('SELECT') ? [{ total: 7 }] : [])) };
      (dataSource as unknown as { transaction: jest.Mock }).transaction = jest.fn((cb) => cb(m));
      expect(await service.borradoDiario()).toBe(7);
      expect(m.query.mock.calls.map(([sql]) => sql)).toEqual([
        'SELECT count(*)::int AS total FROM auditoria',
        'ALTER TABLE auditoria DISABLE TRIGGER auditoria_sin_truncate',
        'TRUNCATE auditoria',
        'ALTER TABLE auditoria ENABLE TRIGGER auditoria_sin_truncate',
      ]);
      expect(auditoriaRepo.save).toHaveBeenCalledWith(expect.objectContaining({ accion: 'BORRADO_DIARIO_AUDITORIA', detalle: { eliminados: 7 } }));
    });
  });

  describe('verificar', () => {
    it('íntegra si la consulta no encuentra problemas; informa el último eslabón', async () => {
      dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 7, secuencia: '7', hash: 'abc' }]);
      await expect(service.verificar()).resolves.toMatchObject({ integra: true, total: 7, ultimo: { secuencia: '7', hash: 'abc' }, problemas: [] });
    });

    it('no íntegra y devuelve dónde se rompe', async () => {
      dataSource.query.mockResolvedValueOnce([{ secuencia: '4', problema: 'alterado' }]).mockResolvedValueOnce([{ total: 7, secuencia: '7', hash: 'abc' }]);
      await expect(service.verificar()).resolves.toMatchObject({ integra: false, problemas: [{ secuencia: '4', problema: 'alterado' }] });
    });

    it('tabla vacía', async () => {
      dataSource.query.mockResolvedValue([]);
      await expect(service.verificar()).resolves.toMatchObject({ integra: true, total: 0, ultimo: null });
    });
  });
});
