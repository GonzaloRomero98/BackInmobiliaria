import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ModeloCasaService } from './modelo-casa.service';
import { ModeloCasa } from './entities/modeloCasa.entity';
import { Proyecto } from '../proyecto/entities/proyecto.entity';
import { Caracteristica } from '../caracteristicas/entities/caracteristica.entity';
import { GaleriaModeloCasa } from './entities/galeriaModeloCasa.entity';
import { CrearModeloCasaDto } from './dto/CrearModeloCasa.dto';
import { EstadoModelo, Moneda, TipoOperacion, TipoVivienda } from './modelo-casa.enum';

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
    it('mapea el DTO a la entidad (estacionamiento -> estacionamientos, campos opcionales por defecto)', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
      modeloRepo.findOne.mockResolvedValue(null);

      const creado = await service.crearModeloCasa(dto());

      expect(creado.estacionamientos).toBe(1);
      expect(creado).toMatchObject({ tipoVivienda: 'CASA', gastosComunes: null, planoUrl: null, subsidios: [], bono: null });
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

  it('crear: por defecto 1 unidad, DISPONIBLE y publicado; acepta unidades y borrador', async () => {
    proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
    modeloRepo.findOne.mockResolvedValue(null);
    expect(await service.crearModeloCasa(dto())).toMatchObject({ unidades: 1, estado: 'DISPONIBLE', activo: true });

    const borrador = await service.crearModeloCasa({ ...dto(), unidades: 25, activo: false });
    expect(borrador).toMatchObject({ unidades: 25, estado: 'DISPONIBLE', activo: false });
  });

  describe('tipo de vivienda y datos comerciales', () => {
    beforeEach(() => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
      modeloRepo.findOne.mockResolvedValue(null);
    });

    it('un departamento se crea sin terreno', async () => {
      const creado = await service.crearModeloCasa({ ...dto(), tipoVivienda: TipoVivienda.DEPARTAMENTO, superficieTerreno: undefined, gastosComunes: 85000 });
      expect(creado).toMatchObject({ tipoVivienda: 'DEPARTAMENTO', superficieTerreno: null, gastosComunes: 85000 });
    });

    it('400 si una casa no trae terreno', async () => {
      await expect(service.crearModeloCasa({ ...dto(), superficieTerreno: undefined })).rejects.toBeInstanceOf(BadRequestException);
      expect(modeloRepo.save).not.toHaveBeenCalled();
    });

    it('una casa en condominio puede tener gastos comunes', async () => {
      expect((await service.crearModeloCasa({ ...dto(), gastosComunes: 40000 })).gastosComunes).toBe(40000);
    });

    it('guarda plano, subsidios y bono (bono vacío o con espacios -> null)', async () => {
      const creado = await service.crearModeloCasa({ ...dto(), planoUrl: 'https://x/plano.png', subsidios: ['DS19'], bono: '  Bono pie 10%  ' });
      expect(creado).toMatchObject({ planoUrl: 'https://x/plano.png', subsidios: ['DS19'], bono: 'Bono pie 10%' });
      expect((await service.crearModeloCasa({ ...dto(), bono: '   ' })).bono).toBeNull();
    });

    it('editar: pasar un departamento sin terreno a casa -> 400; con terreno -> ok', async () => {
      const depto = () => ({ id: 'm1', nombreModelo: 'D', tipoVivienda: 'DEPARTAMENTO', superficieTerreno: null, caracteristicas: [], proyecto: { id: 'p1' } });
      modeloRepo.findOne.mockResolvedValue(depto());
      await expect(service.actualizarModeloCasa('m1', { tipoVivienda: TipoVivienda.CASA })).rejects.toBeInstanceOf(BadRequestException);

      modeloRepo.findOne.mockResolvedValue(depto());
      const r = await service.actualizarModeloCasa('m1', { tipoVivienda: TipoVivienda.CASA, superficieTerreno: 150 });
      expect(r).toMatchObject({ tipoVivienda: 'CASA', superficieTerreno: 150 });
    });

    it('editar: quitar el terreno a una casa -> 400', async () => {
      modeloRepo.findOne.mockResolvedValue({ id: 'm1', nombreModelo: 'C', tipoVivienda: 'CASA', superficieTerreno: 200, caracteristicas: [] });
      await expect(service.actualizarModeloCasa('m1', { superficieTerreno: null })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('actualizarModeloCasa', () => {
    const existente = () => ({ id: 'm1', nombreModelo: 'Casa A', estacionamientos: 1, caracteristicas: [], proyecto: { id: 'p1' } });

    it('busca sin filtrar por publicado (un borrador se puede editar y publicar)', async () => {
      modeloRepo.findOne.mockResolvedValue({ ...existente(), activo: false });
      const r = await service.actualizarModeloCasa('m1', { activo: true });
      expect(modeloRepo.findOne.mock.calls[0][0].where).toEqual({ id: 'm1' });
      expect(r).toMatchObject({ activo: true });
    });

    describe('unidades', () => {
      const ocupado = () => ({ ...existente(), unidades: 5, unidadesReservadas: 2, unidadesVendidas: 1, estado: 'DISPONIBLE' });

      it('400 si baja por debajo de lo reservado o vendido, sin guardar', async () => {
        modeloRepo.findOne.mockResolvedValue(ocupado());
        await expect(service.actualizarModeloCasa('m1', { unidades: 2 }))
          .rejects.toThrow(new BadRequestException('Hay 3 unidades reservadas o vendidas'));
        expect(modeloRepo.save).not.toHaveBeenCalled();
      });

      it('igual a lo ocupado se permite y deja el modelo RESERVADO', async () => {
        modeloRepo.findOne.mockResolvedValue(ocupado());
        expect(await service.actualizarModeloCasa('m1', { unidades: 3 })).toMatchObject({ unidades: 3, estado: 'RESERVADO' });
      });

      it('subir unidades de un modelo agotado lo vuelve DISPONIBLE', async () => {
        modeloRepo.findOne.mockResolvedValue({ ...ocupado(), unidades: 3, estado: 'RESERVADO' });
        expect(await service.actualizarModeloCasa('m1', { unidades: 4 })).toMatchObject({ estado: 'DISPONIBLE' });
      });
    });

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

  describe('nombreDisponible', () => {
    it('libre si nadie lo usa', async () => {
      modeloRepo.findOne.mockResolvedValue(null);
      expect(await service.nombreDisponible('Casa Z')).toEqual({ disponible: true });
      expect(modeloRepo.findOne).toHaveBeenCalledWith({ where: { nombreModelo: 'Casa Z' } });
    });

    it('ocupado si lo usa otro modelo', async () => {
      modeloRepo.findOne.mockResolvedValue({ id: 'otro' });
      expect(await service.nombreDisponible('Casa A')).toEqual({ disponible: false });
      expect(await service.nombreDisponible('Casa A', 'm1')).toEqual({ disponible: false });
    });

    it('al editar, el nombre propio del modelo cuenta como libre', async () => {
      modeloRepo.findOne.mockResolvedValue({ id: 'm1' });
      expect(await service.nombreDisponible('Casa A', 'm1')).toEqual({ disponible: true });
    });
  });

  describe('duplicarModeloCasa', () => {
    const original = () => ({
      id: 'm1', creadoEn: new Date(), nombreModelo: 'Casa A', precio: 3500, activo: true, estado: EstadoModelo.VENDIDO,
      unidades: 5, unidadesReservadas: 2, unidadesVendidas: 3,
      proyecto: { id: 'p1' }, caracteristicas: [{ id: 7 }], imgPrincipal: 'https://x/i.jpg',
      fotos: [{ id: 'f1', urlImagen: 'https://x/1.jpg', orden: 0 }, { id: 'f2', urlImagen: 'https://x/2.jpg', orden: 1 }],
    });

    it('copia datos, características y fotos como borrador DISPONIBLE con el nombre elegido, en un solo save', async () => {
      modeloRepo.findOne.mockResolvedValueOnce(original()).mockResolvedValueOnce(null);

      const copia = await service.duplicarModeloCasa('m1', 'Casa B');

      expect(modeloRepo.findOne).toHaveBeenLastCalledWith({ where: { nombreModelo: 'Casa B' } });
      expect(modeloRepo.save).toHaveBeenCalledTimes(1);
      expect(galeriaRepo.save).not.toHaveBeenCalled();
      const guardado = modeloRepo.save.mock.calls[0][0];
      expect(guardado).toMatchObject({
        nombreModelo: 'Casa B', precio: 3500, activo: false, estado: EstadoModelo.DISPONIBLE,
        unidades: 5, unidadesReservadas: 0, unidadesVendidas: 0,
        proyecto: { id: 'p1' }, caracteristicas: [{ id: 7 }], imgPrincipal: 'https://x/i.jpg',
      });
      expect(guardado.id).toBeUndefined();
      expect(guardado.creadoEn).toBeUndefined();
      // Fotos nuevas (sin id) con las mismas URLs: la cascada las inserta en la misma transacción
      expect(guardado.fotos).toEqual([
        expect.objectContaining({ urlImagen: 'https://x/1.jpg', orden: 0 }),
        expect.objectContaining({ urlImagen: 'https://x/2.jpg', orden: 1 }),
      ]);
      expect(guardado.fotos[0].id).toBeUndefined();
      expect(copia.fotos).toHaveLength(2);
    });

    it('409 sin guardar nada si el nombre ya lo usa otro modelo (no inventa sufijos)', async () => {
      modeloRepo.findOne.mockResolvedValueOnce(original()).mockResolvedValueOnce({ id: 'otro', nombreModelo: 'Casa A (copia)' });
      await expect(service.duplicarModeloCasa('m1', 'Casa A (copia)')).rejects.toBeInstanceOf(ConflictException);
      expect(modeloRepo.save).not.toHaveBeenCalled();
    });

    it('409 si se intenta duplicar con el mismo nombre del original', async () => {
      modeloRepo.findOne.mockResolvedValueOnce(original()).mockResolvedValueOnce(original());
      await expect(service.duplicarModeloCasa('m1', 'Casa A')).rejects.toBeInstanceOf(ConflictException);
      expect(modeloRepo.save).not.toHaveBeenCalled();
    });

    it('si falla el guardado propaga el error y no intenta nada más', async () => {
      modeloRepo.findOne.mockResolvedValueOnce(original()).mockResolvedValueOnce(null);
      modeloRepo.save.mockRejectedValueOnce(new Error('BD caída'));
      await expect(service.duplicarModeloCasa('m1', 'Casa B')).rejects.toThrow('BD caída');
      expect(galeriaRepo.save).not.toHaveBeenCalled();
    });

    it('404 si el original no existe', async () => {
      modeloRepo.findOne.mockResolvedValue(null);
      await expect(service.duplicarModeloCasa('m1', 'Casa B')).rejects.toBeInstanceOf(NotFoundException);
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

    describe('ordenarFotos', () => {
      const fotos = () => [
        { id: 'f1', urlImagen: 'https://x/1.jpg', orden: 0 },
        { id: 'f2', urlImagen: 'https://x/2.jpg', orden: 1 },
        { id: 'f3', urlImagen: 'https://x/3.jpg', orden: 2 },
      ];

      it('asigna el orden según la posición en la lista, en un solo save', async () => {
        galeriaRepo.find.mockResolvedValue(fotos());
        const res = await service.ordenarFotos('m1', ['f3', 'f1', 'f2']);
        expect(galeriaRepo.find).toHaveBeenCalledWith({ where: { modeloCasa: { id: 'm1' } } });
        expect(galeriaRepo.save).toHaveBeenCalledTimes(1);
        expect(res.map((f) => [f.id, f.orden])).toEqual([['f3', 0], ['f1', 1], ['f2', 2]]);
      });

      it.each([
        ['falta una foto', ['f1', 'f2']],
        ['sobra una foto ajena', ['f1', 'f2', 'f3', 'otra']],
        ['cambia una por otra ajena', ['f1', 'f2', 'otra']],
      ])('400 si %s', async (_caso, ids) => {
        galeriaRepo.find.mockResolvedValue(fotos());
        await expect(service.ordenarFotos('m1', ids)).rejects.toBeInstanceOf(BadRequestException);
        expect(galeriaRepo.save).not.toHaveBeenCalled();
      });
    });
  });
});
