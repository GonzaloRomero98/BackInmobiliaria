import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ModeloCasaService } from './modelo-casa.service';
import { ModeloCasa } from './entities/modeloCasa.entity';
import { Proyecto } from '../proyecto/entities/proyecto.entity';
import { Caracteristica } from '../caracteristicas/entities/caracteristica.entity';
import { GaleriaModeloCasa } from './entities/galeriaModeloCasa.entity';
import { CrearModeloCasaDto } from './dto/CrearModeloCasa.dto';
import { Moneda, TipoOperacion } from './modelo-casa.enum';

const mockRepo = () => ({
  findOne: jest.fn(),
  findBy: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  save: jest.fn(async (x) => ({ ...x, id: x.id ?? 'nuevo-id' })),
  remove: jest.fn(),
  update: jest.fn(),
});

describe('ModeloCasaService', () => {
  let modeloRepo: ReturnType<typeof mockRepo>;
  let proyectoRepo: ReturnType<typeof mockRepo>;
  let caracRepo: ReturnType<typeof mockRepo>;
  let galeriaRepo: ReturnType<typeof mockRepo>;
  let service: ModeloCasaService;

  const dto = (): CrearModeloCasaDto => ({
    id_proyecto: '11111111-1111-4111-8111-111111111111',
    nombreModelo: 'Casa A',
    tipoOperacion: TipoOperacion.VENTA,
    dormitorios: 3,
    banos: 2,
    estacionamiento: 1,
    mascotas: true,
    superficieConstruida: 90.5,
    superficieTerreno: 200,
    precio: 3500,
    moneda: Moneda.UF,
    gastosComunes: undefined as unknown as boolean,
    modelo3dUrl: 'https://x/m.glb',
    imgPrincipal: 'https://x/i.jpg',
    caracteristicasID: [],
  });

  beforeEach(() => {
    modeloRepo = mockRepo();
    proyectoRepo = mockRepo();
    caracRepo = mockRepo();
    galeriaRepo = mockRepo();
    service = new ModeloCasaService(
      modeloRepo as unknown as Repository<ModeloCasa>,
      proyectoRepo as unknown as Repository<Proyecto>,
      caracRepo as unknown as Repository<Caracteristica>,
      galeriaRepo as unknown as Repository<GaleriaModeloCasa>,
    );
  });

  describe('crearModeloCasa', () => {
    it('mapea el DTO a la entidad (estacionamiento -> estacionamientos, gastosComunes por defecto false)', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
      modeloRepo.findOne.mockResolvedValue(null);

      const creado = await service.crearModeloCasa(dto());

      expect(creado.estacionamientos).toBe(1);
      expect(creado.gastosComunes).toBe(false);
      expect(creado.proyecto).toEqual({ id: 'p1' });
      expect(creado.caracteristicas).toEqual([]);
    });

    it('404 si el proyecto no existe', async () => {
      proyectoRepo.findOne.mockResolvedValue(null);
      await expect(service.crearModeloCasa(dto())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('400 si alguna caracteristica no existe (ignora ids repetidos)', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
      caracRepo.findBy.mockResolvedValue([{ id: 1, nombre: 'Piscina' }]);
      await expect(
        service.crearModeloCasa({ ...dto(), caracteristicasID: [1, 1, 2] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('asocia las caracteristicas cuando todas existen', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
      modeloRepo.findOne.mockResolvedValue(null);
      caracRepo.findBy.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const creado = await service.crearModeloCasa({ ...dto(), caracteristicasID: [1, 2, 2] });
      expect(creado.caracteristicas).toHaveLength(2);
    });

    it('409 si ya existe un modelo con el mismo nombre', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
      modeloRepo.findOne.mockResolvedValue({ id: 'otro' });
      await expect(service.crearModeloCasa(dto())).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('crear sin modelo 3D lo guarda como null', async () => {
    proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
    modeloRepo.findOne.mockResolvedValue(null);
    const creado = await service.crearModeloCasa({ ...dto(), modelo3dUrl: undefined });
    expect(creado.modelo3dUrl).toBeNull();
  });

  describe('actualizarModeloCasa', () => {
    const existente = () => ({ id: 'm1', nombreModelo: 'Casa A', estacionamientos: 1, caracteristicas: [], proyecto: { id: 'p1' } });

    it('aplica solo los campos enviados y mapea estacionamiento', async () => {
      modeloRepo.findOne.mockResolvedValue(existente());
      const r = await service.actualizarModeloCasa('m1', { precio: 4000, estacionamiento: 2 });
      expect(r).toMatchObject({ id: 'm1', nombreModelo: 'Casa A', precio: 4000, estacionamientos: 2 });
      expect(r).not.toHaveProperty('estacionamiento');
    });

    it('modelo3dUrl null quita el 3D', async () => {
      modeloRepo.findOne.mockResolvedValue({ ...existente(), modelo3dUrl: 'https://x/m.glb' });
      const r = await service.actualizarModeloCasa('m1', { modelo3dUrl: null });
      expect(r.modelo3dUrl).toBeNull();
    });

    it('409 si el nombre nuevo ya lo usa otro modelo; mismo nombre no consulta', async () => {
      modeloRepo.findOne.mockResolvedValueOnce(existente()).mockResolvedValueOnce({ id: 'otro' });
      await expect(service.actualizarModeloCasa('m1', { nombreModelo: 'Casa B' })).rejects.toBeInstanceOf(ConflictException);

      modeloRepo.findOne.mockReset().mockResolvedValue(existente());
      await service.actualizarModeloCasa('m1', { nombreModelo: 'Casa A' });
      expect(modeloRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('cambia proyecto y características validando que existan', async () => {
      modeloRepo.findOne.mockResolvedValue(existente());
      proyectoRepo.findOne.mockResolvedValue(null);
      await expect(service.actualizarModeloCasa('m1', { id_proyecto: 'p2' })).rejects.toBeInstanceOf(NotFoundException);

      caracRepo.findBy.mockResolvedValue([{ id: 1 }]);
      await expect(service.actualizarModeloCasa('m1', { caracteristicasID: [1, 2] })).rejects.toBeInstanceOf(BadRequestException);

      const r = await service.actualizarModeloCasa('m1', { caracteristicasID: [] });
      expect(r.caracteristicas).toEqual([]);
    });
  });

  it('despublicarModeloCasa marca activo=false; 404 si no existe o ya estaba despublicado', async () => {
    modeloRepo.update.mockResolvedValue({ affected: 1 });
    await service.despublicarModeloCasa('m1');
    expect(modeloRepo.update).toHaveBeenCalledWith({ id: 'm1', activo: true }, { activo: false });

    modeloRepo.update.mockResolvedValue({ affected: 0 });
    await expect(service.despublicarModeloCasa('m1')).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('mostrarModelosCasa', () => {
    const where = () => modeloRepo.find.mock.calls[0][0].where;
    const order = () => modeloRepo.find.mock.calls[0][0].order;

    beforeEach(() => modeloRepo.find.mockResolvedValue([]));

    it('sin filtros: solo activos, con proyecto activo, por nombre', async () => {
      await service.mostrarModelosCasa();
      expect(where()).toEqual({ activo: true, proyecto: { activo: true } });
      expect(order()).toEqual({ nombreModelo: 'ASC', fotos: { orden: 'ASC' } });
    });

    it('filtra por proyecto y tipo de operación', async () => {
      await service.mostrarModelosCasa({ id_proyecto: 'p1', tipoOperacion: TipoOperacion.ARRIENDO });
      expect(where()).toEqual({ activo: true, proyecto: { id: 'p1', activo: true }, tipoOperacion: 'ARRIENDO' });
    });

    it('filtra por ubicación (región y comuna) a través del proyecto', async () => {
      await service.mostrarModelosCasa({ id_region: 7, id_ciudad: 3 });
      expect(where().proyecto).toEqual({ activo: true, ciudad: { id: 3, region: { id: 7 } } });
    });

    it('rango de precio en la moneda indicada y mínimos de dormitorios, baños y superficie', async () => {
      await service.mostrarModelosCasa({
        moneda: Moneda.UF, precioMin: 2000, precioMax: 4000, dormitorios: 3, banos: 2, superficieMin: 80, mascotas: true,
      });
      const w = where();
      expect(w.moneda).toBe('UF');
      expect(w.mascotas).toBe(true);
      expect(w.precio).toMatchObject({ type: 'between', value: [2000, 4000] });
      expect(w.dormitorios).toMatchObject({ type: 'moreThanOrEqual', value: 3 });
      expect(w.banos).toMatchObject({ type: 'moreThanOrEqual', value: 2 });
      expect(w.superficieConstruida).toMatchObject({ type: 'moreThanOrEqual', value: 80 });
    });

    it('precio solo mínimo o solo máximo', async () => {
      await service.mostrarModelosCasa({ precioMax: 500000 });
      expect(where().precio).toMatchObject({ type: 'lessThanOrEqual', value: 500000 });
      await service.mostrarModelosCasa({ precioMin: 100 });
      expect(modeloRepo.find.mock.calls[1][0].where.precio).toMatchObject({ type: 'moreThanOrEqual', value: 100 });
    });

    it('mascotas=false también filtra', async () => {
      await service.mostrarModelosCasa({ mascotas: false });
      expect(where().mascotas).toBe(false);
    });

    it.each([
      ['precio_asc', { precio: 'ASC' }],
      ['precio_desc', { precio: 'DESC' }],
      ['superficie_desc', { superficieConstruida: 'DESC' }],
      ['recientes', { creadoEn: 'DESC' }],
    ] as const)('orden %s', async (orden, esperado) => {
      await service.mostrarModelosCasa({ orden });
      expect(order()).toEqual({ ...esperado, fotos: { orden: 'ASC' } });
    });
  });

  it('obtenerModeloByID lanza 404 si no existe', async () => {
    modeloRepo.findOne.mockResolvedValue(null);
    await expect(service.obtenerModeloByID('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('fotos', () => {
    it('agregarFoto usa la cantidad actual como orden por defecto', async () => {
      modeloRepo.findOne.mockResolvedValue({ id: 'm1' });
      galeriaRepo.findOne.mockResolvedValue(null);
      galeriaRepo.count.mockResolvedValue(3);

      const foto = await service.agregarFoto('m1', { urlImagen: 'https://x/f.jpg' });
      expect(foto).toEqual({ id: 'nuevo-id', urlImagen: 'https://x/f.jpg', orden: 3 });
    });

    it('agregarFoto respeta orden 0 explícito', async () => {
      modeloRepo.findOne.mockResolvedValue({ id: 'm1' });
      galeriaRepo.findOne.mockResolvedValue(null);
      galeriaRepo.count.mockResolvedValue(5);

      const foto = await service.agregarFoto('m1', { urlImagen: 'https://x/f.jpg', orden: 0 });
      expect(foto.orden).toBe(0);
    });

    it('agregarFoto 409 si la foto ya está en la galería', async () => {
      modeloRepo.findOne.mockResolvedValue({ id: 'm1' });
      galeriaRepo.findOne.mockResolvedValue({ id: 'f1' });
      await expect(
        service.agregarFoto('m1', { urlImagen: 'https://x/f.jpg' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('agregarFoto 404 si el modelo no existe', async () => {
      modeloRepo.findOne.mockResolvedValue(null);
      await expect(
        service.agregarFoto('m1', { urlImagen: 'https://x/f.jpg' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('eliminarFoto borra la foto del modelo indicado', async () => {
      galeriaRepo.findOne.mockResolvedValue({ id: 'f1' });
      await service.eliminarFoto('m1', 'f1');
      expect(galeriaRepo.findOne).toHaveBeenCalledWith({ where: { id: 'f1', modeloCasa: { id: 'm1' } } });
      expect(galeriaRepo.remove).toHaveBeenCalledWith({ id: 'f1' });
    });

    it('eliminarFoto 404 si la foto no pertenece al modelo', async () => {
      galeriaRepo.findOne.mockResolvedValue(null);
      await expect(service.eliminarFoto('m1', 'f1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
