import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProyectoService } from './proyecto.service';
import { Proyecto } from './entities/proyecto.entity';
import { Ciudad } from '../ubicacion/entities/ciudad.entity';
import { NormativaProyecto } from './entities/normativaProyecto.entity';
import { NormativaDto } from './dto/normativa.dto';
import { EntornoService } from './entorno.service';

const esperarTareas = () => new Promise((resolve) => setImmediate(resolve));

describe('ProyectoService', () => {
  let proyectoRepo: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let entornoService: { calcular: jest.Mock };
  let ciudadRepo: { findOne: jest.Mock };
  let normativaRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let service: ProyectoService;

  beforeEach(() => {
    proyectoRepo = {
      findOne: jest.fn(), find: jest.fn(), create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: 'p1', ...x })),
      update: jest.fn(),
    };
    entornoService = { calcular: jest.fn().mockResolvedValue({ radio: 1000, lugares: [], resumen: {} }) };
    ciudadRepo = { findOne: jest.fn() };
    normativaRepo = { findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn(async (x) => x) };
    service = new ProyectoService(
      proyectoRepo as unknown as Repository<Proyecto>,
      ciudadRepo as unknown as Repository<Ciudad>,
      normativaRepo as unknown as Repository<NormativaProyecto>,
      entornoService as unknown as EntornoService,
    );
  });

  it('crea el proyecto asociado a la ciudad, con ubicación', async () => {
    ciudadRepo.findOne.mockResolvedValue({ id: 3, nombre: 'Temuco' });
    const p = await service.crearProyecto({
      nombre: 'Proyecto', id_ciudad: 3, descripcion: 'desc', imagenPortada: 'https://x/p.jpg',
      direccion: 'Av. Alemania 100', latitud: -38.7359, longitud: -72.5904,
    });
    expect(p.ciudad).toEqual({ id: 3, nombre: 'Temuco' });
    expect(p).toMatchObject({ direccion: 'Av. Alemania 100', latitud: -38.7359, longitud: -72.5904 });
  });

  it('descripción y ubicación son opcionales', async () => {
    ciudadRepo.findOne.mockResolvedValue({ id: 3 });
    const p = await service.crearProyecto({ nombre: 'P', id_ciudad: 3, imagenPortada: 'https://x/p.jpg' });
    expect(p).toMatchObject({ descripcion: '', direccion: null, latitud: null, longitud: null });
  });

  it('404 si la ciudad no existe', async () => {
    ciudadRepo.findOne.mockResolvedValue(null);
    await expect(
      service.crearProyecto({ nombre: 'P', id_ciudad: 99, descripcion: '', imagenPortada: '' }),
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

    it('404 al guardar si el proyecto no existe', async () => {
      proyectoRepo.findOne.mockResolvedValue(null);
      await expect(service.guardarNormativa('x', dto)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
  describe('entorno', () => {
    it('al crear con coordenadas se calcula el entorno en segundo plano', async () => {
      ciudadRepo.findOne.mockResolvedValue({ id: 3 });
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1', latitud: -35.4, longitud: -71.6 });
      await service.crearProyecto({ nombre: 'P', id_ciudad: 3, imagenPortada: 'x', latitud: -35.4, longitud: -71.6 });
      await esperarTareas();
      expect(entornoService.calcular).toHaveBeenCalledWith(-35.4, -71.6);
      expect(proyectoRepo.update).toHaveBeenCalledWith({ id: 'p1' }, expect.objectContaining({ entorno: expect.any(Object) }));
    });

    it('sin coordenadas no se consulta OpenStreetMap', async () => {
      ciudadRepo.findOne.mockResolvedValue({ id: 3 });
      await service.crearProyecto({ nombre: 'P', id_ciudad: 3, imagenPortada: 'x' });
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
});
