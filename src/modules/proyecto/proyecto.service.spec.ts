import { EtapaProyecto } from './proyecto.enum';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { ModeloCasa } from '../modeloCasa/entities/modeloCasa.entity';
import { ProyectoService } from './proyecto.service';
import { Proyecto } from './entities/proyecto.entity';
import { Ciudad } from '../ubicacion/entities/ciudad.entity';
import { NormativaProyecto } from './entities/normativaProyecto.entity';
import { NormativaDto } from './dto/normativa.dto';
import { EntornoService } from './entorno.service';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../s3/s3.service';

// S3Service real con un bucket de prueba: la portada nueva tiene que estar en la carpeta "proyectos" de ese bucket.
const s3 = new S3Service(new ConfigService({ AWS_S3_BUCKET: 'bucket-test', AWS_REGION: 'us-east-1' }));
const PORTADA = 'https://bucket-test.s3.us-east-1.amazonaws.com/proyectos/0b7c2c64-7a8e-4f0f-9a43-2f1d6f1e9b10.jpg';

const esperarTareas = () => new Promise((resolve) => setImmediate(resolve));

describe('ProyectoService', () => {
  let proyectoRepo: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let entornoService: { calcular: jest.Mock };
  let ciudadRepo: { findOne: jest.Mock };
  let normativaRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let service: ProyectoService;

  beforeEach(() => {
    proyectoRepo = {
      findOne: jest.fn(), find: jest.fn(async () => []), create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: 'p1', ...x })),
      update: jest.fn(),
    };
    Object.assign(proyectoRepo, { manager: { find: jest.fn(async () => []) } });
    entornoService = { calcular: jest.fn().mockResolvedValue({ radio: 1000, lugares: [], resumen: {} }) };
    ciudadRepo = { findOne: jest.fn() };
    normativaRepo = { findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn(async (x) => x) };
    service = new ProyectoService(
      proyectoRepo as unknown as Repository<Proyecto>,
      ciudadRepo as unknown as Repository<Ciudad>,
      normativaRepo as unknown as Repository<NormativaProyecto>,
      entornoService as unknown as EntornoService,
      s3,
    );
  });

  it('portada nueva fuera de la carpeta "proyectos" del bucket -> 400 sin guardar; la portada guardada se puede reenviar', async () => {
    ciudadRepo.findOne.mockResolvedValue({ id: 3 });
    await expect(service.crearProyecto({ nombre: 'P', id_ciudad: 3, imagenPortada: 'https://evil.cl/p.jpg' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(proyectoRepo.save).not.toHaveBeenCalled();

    const antigua = 'https://bucket-test.s3.us-east-1.amazonaws.com/models/vieja.jpg';
    proyectoRepo.findOne.mockResolvedValue({ id: 'p1', nombre: 'P', latitud: null, longitud: null, imagenPortada: antigua });
    await expect(service.actualizarProyecto('p1', { imagenPortada: antigua, nombre: 'Q' })).resolves.toMatchObject({ nombre: 'Q' });
    await expect(service.actualizarProyecto('p1', { imagenPortada: 'https://evil.cl/p.jpg' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea el proyecto asociado a la ciudad, con ubicación', async () => {
    ciudadRepo.findOne.mockResolvedValue({ id: 3, nombre: 'Temuco' });
    const p = await service.crearProyecto({
      nombre: 'Proyecto', id_ciudad: 3, descripcion: 'desc', imagenPortada: PORTADA,
      direccion: 'Av. Alemania 100', latitud: -38.7359, longitud: -72.5904,
      etapa: EtapaProyecto.EN_BLANCO, fechaEntrega: '2027-06-30',
    });
    expect(p).toMatchObject({ etapa: 'EN_BLANCO', fechaEntrega: '2027-06-30' });
    expect(p.ciudad).toEqual({ id: 3, nombre: 'Temuco' });
    expect(p).toMatchObject({ direccion: 'Av. Alemania 100', latitud: -38.7359, longitud: -72.5904 });
  });

  it('descripción y ubicación son opcionales', async () => {
    ciudadRepo.findOne.mockResolvedValue({ id: 3 });
    const p = await service.crearProyecto({ nombre: 'P', id_ciudad: 3, imagenPortada: PORTADA });
    expect(p).toMatchObject({ descripcion: '', direccion: null, latitud: null, longitud: null, etapa: null, fechaEntrega: null });
  });

  it('404 si la ciudad no existe', async () => {
    ciudadRepo.findOne.mockResolvedValue(null);
    await expect(
      service.crearProyecto({ nombre: 'P', id_ciudad: 99, descripcion: '', imagenPortada: PORTADA }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mostrarProyectos filtra por ciudad si se indica', async () => {
    proyectoRepo.find.mockResolvedValue([]);
    await service.mostrarProyectos(3);
    expect(proyectoRepo.find.mock.calls[0][0].where).toEqual({ activo: true, ciudad: { id: 3 } });
    await service.mostrarProyectos();
    expect(proyectoRepo.find.mock.calls[1][0].where).toEqual({ activo: true });
  });

  it('obtenerProyectoPorID 404 si no existe', async () => {
    proyectoRepo.findOne.mockResolvedValue(null);
    await expect(service.obtenerProyectoPorID('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('proyectos casi en el mismo punto (< 50 m)', () => {
    // Plaza de Arica. 0,0001° de latitud son unos 11 m y 0,003° unos 334 m.
    const OTRO = { id: 'otro', nombre: 'Los Robles', activo: true, latitud: -18.4783, longitud: -70.3126 };
    const base = { nombre: 'Nuevo', id_ciudad: 3, imagenPortada: PORTADA };
    beforeEach(() => {
      ciudadRepo.findOne.mockResolvedValue({ id: 3 });
      proyectoRepo.find.mockResolvedValue([OTRO]);
    });

    it('crear a 11 m de otro proyecto sin confirmar -> 409 con el proyecto y la distancia; no guarda', async () => {
      const error = await service.crearProyecto({ ...base, latitud: -18.4784, longitud: -70.3126 }).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({
        message: expect.stringContaining('11 m del proyecto «Los Robles»'),
        cercanos: [{ id: 'otro', nombre: 'Los Robles', activo: true, distancia: 11 }],
      });
      expect(proyectoRepo.save).not.toHaveBeenCalled();
    });

    it('con confirmarCercania se guarda, y el campo no llega a la entidad', async () => {
      await service.crearProyecto({ ...base, latitud: -18.4784, longitud: -70.3126, confirmarCercania: true });
      expect(proyectoRepo.save).toHaveBeenCalled();
      expect(proyectoRepo.save.mock.calls[0][0]).not.toHaveProperty('confirmarCercania');
    });

    it('a 334 m (dentro de 1 km pero no un duplicado) se guarda sin preguntar; sin ubicación no consulta', async () => {
      await service.crearProyecto({ ...base, latitud: -18.4813, longitud: -70.3126 });
      expect(proyectoRepo.save).toHaveBeenCalledTimes(1);
      proyectoRepo.find.mockClear();
      await service.crearProyecto(base);
      expect(proyectoRepo.find).not.toHaveBeenCalled();
    });

    it('un despublicado también cuenta y el mensaje lo dice', async () => {
      proyectoRepo.find.mockResolvedValue([{ ...OTRO, activo: false }]);
      await expect(service.crearProyecto({ ...base, latitud: -18.4783, longitud: -70.3126 }))
        .rejects.toThrow('del proyecto «Los Robles» (despublicado)');
    });

    it('editar: se compara contra los demás (no contra sí mismo) y solo si cambia la ubicación', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1', latitud: -18.49, longitud: -70.30, ciudad: { id: 3 } });
      proyectoRepo.find.mockResolvedValue([OTRO, { id: 'p1', nombre: 'Yo mismo', activo: true, latitud: -18.4783, longitud: -70.3126 }]);
      const error = await service.actualizarProyecto('p1', { latitud: -18.4783, longitud: -70.3126 }).catch((e) => e);
      expect(error.getResponse().cercanos.map((c: { id: string }) => c.id)).toEqual(['otro']);

      await service.actualizarProyecto('p1', { latitud: -18.4783, longitud: -70.3126, confirmarCercania: true });
      expect(proyectoRepo.save.mock.calls.at(-1)![0]).not.toHaveProperty('confirmarCercania');

      proyectoRepo.find.mockClear();
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1', latitud: -18.4783, longitud: -70.3126, ciudad: { id: 3 } });
      await service.actualizarProyecto('p1', { nombre: 'Otro nombre', latitud: -18.4783, longitud: -70.3126 });
      expect(proyectoRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('actualizarProyecto', () => {
    it('actualiza solo los campos enviados', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1', nombre: 'Viejo', latitud: null, ciudad: { id: 1 } });
      const p = await service.actualizarProyecto('p1', { latitud: -35.4, longitud: -71.6 });
      expect(p).toMatchObject({ id: 'p1', nombre: 'Viejo', latitud: -35.4, longitud: -71.6, ciudad: { id: 1 } });
    });

    it('cambia la ciudad validando que exista', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1', ciudad: { id: 1 } });
      ciudadRepo.findOne.mockResolvedValue({ id: 2 });
      expect((await service.actualizarProyecto('p1', { id_ciudad: 2 })).ciudad).toEqual({ id: 2 });

      ciudadRepo.findOne.mockResolvedValue(null);
      await expect(service.actualizarProyecto('p1', { id_ciudad: 99 })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404 si el proyecto no existe', async () => {
      proyectoRepo.findOne.mockResolvedValue(null);
      await expect(service.actualizarProyecto('x', { nombre: 'N' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('normativa', () => {
    const dto: NormativaDto = {
      instrumento: 'PRC Talca', zona: 'ZH-2', usosPermitidos: 'Residencial', alturaMaximaPisos: 4,
      fechaConsulta: '2026-10-01',
    };

    it('obtenerNormativa 404 si el proyecto no tiene ficha', async () => {
      normativaRepo.findOne.mockResolvedValue(null);
      await expect(service.obtenerNormativa('p1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('crea la ficha con los campos no enviados en null', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
      normativaRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'n1', ...dto });

      await service.guardarNormativa('p1', dto);

      expect(normativaRepo.save).toHaveBeenCalledWith({
        ...dto, proyecto: { id: 'p1' }, riesgos: [], alturaMaximaMetros: null, densidadMaxima: null,
        coefConstructibilidad: null, coefOcupacionSuelo: null, urlOrdenanza: null, observaciones: null,
      });
    });

    it('reemplaza la ficha existente (mismo id) y borra los campos que ya no se envían', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
      normativaRepo.findOne.mockResolvedValue({ id: 'n1', ...dto, densidadMaxima: 300, riesgos: ['TSUNAMI'] });

      await service.guardarNormativa('p1', { ...dto, zona: 'ZH-3' });

      expect(normativaRepo.save.mock.calls[0][0]).toMatchObject({ id: 'n1', zona: 'ZH-3', densidadMaxima: null, riesgos: [] });
    });

    it('devuelve los modelos CASA que exceden el nuevo máximo construido (sin bloquear)', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
      normativaRepo.findOne.mockResolvedValue({ id: 'n1', ...dto, coefConstructibilidad: 0.5 });
      const find = jest.fn().mockResolvedValue([
        { id: 'm1', nombreModelo: 'Casa A', tipoVivienda: 'CASA', superficieConstruida: 110.5, superficieTerreno: 200 },
        { id: 'm2', nombreModelo: 'Casa B', tipoVivienda: 'CASA', superficieConstruida: 100, superficieTerreno: 200 },
        { id: 'm3', nombreModelo: 'Depto', tipoVivienda: 'DEPARTAMENTO', superficieConstruida: 500, superficieTerreno: null },
      ]);
      Object.assign(proyectoRepo, { manager: { find } });

      const respuesta = await service.guardarNormativa('p1', { ...dto, coefConstructibilidad: 0.5 });

      expect(respuesta.modelosQueExceden).toEqual([{ id: 'm1', nombreModelo: 'Casa A', exceso: 10.5 }]);
    });

    it('404 al guardar si el proyecto no existe', async () => {
      proyectoRepo.findOne.mockResolvedValue(null);
      await expect(service.guardarNormativa('x', dto)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
  describe('entorno', () => {
    it('al crear con coordenadas se calcula el entorno en segundo plano', async () => {
      ciudadRepo.findOne.mockResolvedValue({ id: 3 });
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1', latitud: -35.4, longitud: -71.6 });
      await service.crearProyecto({ nombre: 'P', id_ciudad: 3, imagenPortada: PORTADA, latitud: -35.4, longitud: -71.6 });
      await esperarTareas();
      expect(entornoService.calcular).toHaveBeenCalledWith(-35.4, -71.6);
      expect(proyectoRepo.update).toHaveBeenCalledWith({ id: 'p1' }, expect.objectContaining({ entorno: expect.any(Object) }));
    });

    it('sin coordenadas no se consulta OpenStreetMap', async () => {
      ciudadRepo.findOne.mockResolvedValue({ id: 3 });
      await service.crearProyecto({ nombre: 'P', id_ciudad: 3, imagenPortada: PORTADA });
      await esperarTareas();
      expect(entornoService.calcular).not.toHaveBeenCalled();
    });

    it('cambiar la ubicación invalida el entorno guardado y lo recalcula', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1', latitud: -35.4, longitud: -71.6 });
      await service.actualizarProyecto('p1', { latitud: -35.5 });
      expect(proyectoRepo.save.mock.calls[0][0]).toMatchObject({ entorno: null, entornoActualizadoEn: null });
      await esperarTareas();
      expect(entornoService.calcular).toHaveBeenCalled();
    });

    it('cambiar otros datos no toca el entorno', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1', latitud: -35.4, longitud: -71.6 });
      await service.actualizarProyecto('p1', { nombre: 'Nuevo', latitud: -35.4 });
      expect(proyectoRepo.save.mock.calls[0][0]).not.toHaveProperty('entorno');
      await esperarTareas();
      expect(entornoService.calcular).not.toHaveBeenCalled();
    });

    it('si OpenStreetMap falla en segundo plano, guardar el proyecto igual funciona', async () => {
      entornoService.calcular.mockRejectedValue(new Error('caído'));
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1', latitud: -35.4, longitud: -71.6 });
      await expect(service.actualizarProyecto('p1', { longitud: -71.7 })).resolves.toBeDefined();
      await esperarTareas();
    });

    it('actualizarEntorno exige coordenadas', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1', latitud: null, longitud: null });
      await expect(service.actualizarEntorno('p1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('obtenerEntorno 404 si aún no se calculó', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1', entorno: null, entornoActualizadoEn: null });
      await expect(service.obtenerEntorno('p1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
  describe('eliminarProyecto', () => {
    // Modelos con solicitudes, como los devuelve la consulta única (SELECT DISTINCT).
    let qb: Record<'innerJoin' | 'select' | 'where' | 'orderBy' | 'getRawMany', jest.Mock>;
    let manager: { findOne: jest.Mock; find: jest.Mock; createQueryBuilder: jest.Mock; delete: jest.Mock };
    beforeEach(() => {
      qb = { innerJoin: jest.fn(), select: jest.fn(), where: jest.fn(), orderBy: jest.fn(), getRawMany: jest.fn(async () => []) };
      for (const paso of ['innerJoin', 'select', 'where', 'orderBy'] as const) qb[paso].mockReturnValue(qb);
      manager = {
        findOne: jest.fn(async () => ({ id: 'p1', nombre: 'Los Robles' })),
        find: jest.fn(async () => [{ id: 'm1' }, { id: 'm2' }]),
        createQueryBuilder: jest.fn(() => qb), delete: jest.fn(),
      };
      Object.assign(proyectoRepo, { manager: { transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)) } });
    });

    it('borra sus modelos y luego el proyecto si ninguno tiene solicitudes', async () => {
      await expect(service.eliminarProyecto('p1')).resolves.toEqual({ nombre: 'Los Robles' });
      expect(manager.delete).toHaveBeenNthCalledWith(1, ModeloCasa, { id: In(['m1', 'm2']) });
      expect(manager.delete).toHaveBeenNthCalledWith(2, Proyecto, { id: 'p1' });
    });

    it('sin modelos borra solo el proyecto', async () => {
      manager.find.mockResolvedValue([]);
      await service.eliminarProyecto('p1');
      expect(manager.delete).toHaveBeenCalledTimes(1);
      expect(manager.delete).toHaveBeenCalledWith(Proyecto, { id: 'p1' });
    });

    it('409 nombrando los modelos con solicitudes, sin borrar nada', async () => {
      qb.getRawMany.mockResolvedValue([{ nombre: 'Casa B' }]);
      await expect(service.eliminarProyecto('p1')).rejects.toThrow('el modelo «Casa B» tiene solicitudes de clientes');
      expect(manager.delete).not.toHaveBeenCalled();

      qb.getRawMany.mockResolvedValue([{ nombre: 'Casa A' }, { nombre: 'Casa B' }]);
      await expect(service.eliminarProyecto('p1')).rejects.toThrow('los modelos «Casa A», «Casa B» tienen solicitudes de clientes');
    });

    it('revisa las solicitudes de todos los modelos en una sola consulta, no una por modelo', async () => {
      await service.eliminarProyecto('p1');
      expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(qb.select).toHaveBeenCalledWith('DISTINCT m.nombreModelo', 'nombre');
      expect(qb.where).toHaveBeenCalledWith('m.proyecto = :id', { id: 'p1' });
    });

    it('404 si no existe', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.eliminarProyecto('p1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
