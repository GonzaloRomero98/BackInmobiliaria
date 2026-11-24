import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ModeloCasaService } from './modelo-casa.service';
import { ModeloCasa } from './entities/modeloCasa.entity';
import { Proyecto } from '../proyecto/entities/proyecto.entity';
import { Caracteristica } from '../caracteristicas/entities/caracteristica.entity';
import { GaleriaModeloCasa } from './entities/galeriaModeloCasa.entity';
import { CrearModeloCasaDto } from './dto/CrearModeloCasa.dto';
import { EstadoModelo, Moneda, TipoOperacion, TipoVivienda } from './modelo-casa.enum';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../s3/s3.service';
import { NormativaProyecto } from '../proyecto/entities/normativaProyecto.entity';

// S3Service real con un bucket de prueba: las URLs nuevas tienen que ser de ese bucket y de su carpeta.
const s3 = new S3Service(new ConfigService({ AWS_S3_BUCKET: 'bucket-test', AWS_REGION: 'us-east-1' }));
const BUCKET = 'https://bucket-test.s3.us-east-1.amazonaws.com/';
const IMG = `${BUCKET}modelosImagenes/0b7c2c64-7a8e-4f0f-9a43-2f1d6f1e9b10.jpg`;
const PLANO = `${BUCKET}modelosImagenes/1c8d3d75-8b9f-4a1a-8b54-3a2e7a2fac21.png`;
const FOTO = `${BUCKET}modelosImagenes/2d9e4e86-9ca0-4b2b-9c65-4b3f8b3abd32.webp`;
const M3D = `${BUCKET}modelos3D/3eaf5f97-adb1-4c3c-8d76-5c4a9c4bce43.glb`;

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
  let normativaRepo: ReturnType<typeof mockRepo>;
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
    modelo3dUrl: M3D,
    imgPrincipal: IMG,
    caracteristicasID: [],
  });

  let bloqueo: { findOne: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    modeloRepo = mockRepo();
    bloqueo = {
      findOne: jest.fn(async () => modeloRepo.findOne.mock.results.at(-1)?.value),
      save: jest.fn((_entidad: unknown, x: object) => modeloRepo.save(x)),
    };
    Object.assign(modeloRepo, { manager: { transaction: jest.fn((cb: (m: typeof bloqueo) => unknown) => cb(bloqueo)) } });
    proyectoRepo = mockRepo();
    caracRepo = mockRepo();
    galeriaRepo = mockRepo();
    normativaRepo = mockRepo();
    service = new ModeloCasaService(
      modeloRepo as unknown as Repository<ModeloCasa>,
      proyectoRepo as unknown as Repository<Proyecto>,
      caracRepo as unknown as Repository<Caracteristica>,
      galeriaRepo as unknown as Repository<GaleriaModeloCasa>,
      normativaRepo as unknown as Repository<NormativaProyecto>,
      s3,
    );
  });

  describe('archivos (URLs de S3)', () => {
    it.each([
      ['imagen de otro dominio', { imgPrincipal: 'https://evil.cl/a.jpg' }],
      ['plano en la carpeta de perfiles', { planoUrl: `${BUCKET}perfiles/0b7c2c64-7a8e-4f0f-9a43-2f1d6f1e9b10.png` }],
      ['3D en la carpeta de imágenes', { modelo3dUrl: IMG }],
    ])('crear con %s -> 400 y no guarda', async (_caso, cambio) => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
      await expect(service.crearModeloCasa({ ...dto(), ...cambio })).rejects.toBeInstanceOf(BadRequestException);
      expect(modeloRepo.save).not.toHaveBeenCalled();
    });

    it('editar reenviando las URLs guardadas con formato antiguo se acepta; una URL nueva externa no', async () => {
      const antigua = `${BUCKET}models/0b7c2c64-7a8e-4f0f-9a43-2f1d6f1e9b10.jpg`;
      const existente = { id: 'm1', proyecto: { id: 'p1' }, nombreModelo: 'Casa A', tipoVivienda: 'CASA', superficieTerreno: 200, caracteristicas: [],
        imgPrincipal: antigua, planoUrl: antigua, modelo3dUrl: null };
      modeloRepo.findOne.mockResolvedValue(existente);
      await expect(service.actualizarModeloCasa('m1', { imgPrincipal: antigua, planoUrl: antigua, modelo3dUrl: null, precio: 4000 }))
        .resolves.toMatchObject({ precio: 4000 });

      modeloRepo.findOne.mockResolvedValue(existente);
      await expect(service.actualizarModeloCasa('m1', { imgPrincipal: 'https://evil.cl/a.jpg' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('agregar foto de otro dominio -> 400 sin consultar la BD', async () => {
      await expect(service.agregarFoto('m1', { urlImagen: 'https://evil.cl/a.jpg' })).rejects.toBeInstanceOf(BadRequestException);
      expect(modeloRepo.findOne).not.toHaveBeenCalled();
    });
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

  describe('normativa: máximo construido (confirmarExceso)', () => {
    // Terreno 200 m² con coeficiente 0,45 -> máximo 90 m²; el dto base construye 90,5 m² (excede 0,5).
    const conCoeficiente = (coefConstructibilidad: number | null) => {
      proyectoRepo.findOne.mockResolvedValue({ id: 'p1' });
      normativaRepo.findOne.mockResolvedValue(coefConstructibilidad === null ? null : { coefConstructibilidad });
    };

    it('crear: 409 con exceso y máximo redondeados, sin guardar', async () => {
      conCoeficiente(0.45);
      const error = await service.crearModeloCasa(dto()).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({ exceso: 0.5, maximoConstruido: 90 });
      expect(modeloRepo.save).not.toHaveBeenCalled();
    });

    it('crear con confirmarExceso guarda, y el campo no llega a la entidad', async () => {
      conCoeficiente(0.45);
      await service.crearModeloCasa({ ...dto(), confirmarExceso: true });
      expect(modeloRepo.save.mock.calls[0][0]).not.toHaveProperty('confirmarExceso');
    });

    it('no bloquea si no excede, si no hay normativa o si el coeficiente falta o es 0', async () => {
      for (const coef of [0.5, null, 0]) {
        modeloRepo.save.mockClear();
        conCoeficiente(coef);
        await service.crearModeloCasa(dto());
        expect(modeloRepo.save).toHaveBeenCalledTimes(1);
      }
    });

    it('no bloquea un departamento ni una casa sin terreno válido', async () => {
      conCoeficiente(0.01);
      await service.crearModeloCasa({ ...dto(), tipoVivienda: TipoVivienda.DEPARTAMENTO, superficieTerreno: null });
      expect(modeloRepo.save).toHaveBeenCalledTimes(1);
    });

    it('evita errores de punto flotante: 0,1 × 3 = 0,3 no excede 0,3 m²', async () => {
      conCoeficiente(0.1);
      await service.crearModeloCasa({ ...dto(), superficieTerreno: 3, superficieConstruida: 0.3 });
      expect(modeloRepo.save).toHaveBeenCalledTimes(1);
    });

    it('editar: 409 sin confirmar; al cambiar de proyecto se evalúa con la normativa del proyecto nuevo', async () => {
      modeloRepo.findOne.mockResolvedValue({ id: 'm1', proyecto: { id: 'p0' }, tipoVivienda: TipoVivienda.CASA, superficieConstruida: 90.5, superficieTerreno: 200, unidades: 1, unidadesReservadas: 0, unidadesVendidas: 0, imgPrincipal: IMG });
      proyectoRepo.findOne.mockResolvedValue({ id: 'p2' });
      normativaRepo.findOne.mockResolvedValue({ coefConstructibilidad: 0.45 });

      await expect(service.actualizarModeloCasa('m1', { id_proyecto: '22222222-2222-4222-8222-222222222222' })).rejects.toBeInstanceOf(ConflictException);
      expect(normativaRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { proyecto: { id: 'p2' } } }));

      await service.actualizarModeloCasa('m1', { id_proyecto: '22222222-2222-4222-8222-222222222222', confirmarExceso: true });
      expect(modeloRepo.save).toHaveBeenCalledTimes(1);
    });
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
      const creado = await service.crearModeloCasa({ ...dto(), planoUrl: PLANO, subsidios: ['DS19'], bono: '  Bono pie 10%  ' });
      expect(creado).toMatchObject({ planoUrl: PLANO, subsidios: ['DS19'], bono: 'Bono pie 10%' });
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

      it('una reserva confirmada durante la edición no se pisa: usa los contadores leídos con la fila bloqueada', async () => {
        modeloRepo.findOne.mockResolvedValue({ ...existente(), unidades: 3, unidadesReservadas: 0, unidadesVendidas: 0, estado: 'DISPONIBLE' });
        bloqueo.findOne.mockResolvedValue({ id: 'm1', unidadesReservadas: 3, unidadesVendidas: 0 });

        const r = await service.actualizarModeloCasa('m1', { precio: 4000 });

        expect(bloqueo.findOne).toHaveBeenCalledWith(ModeloCasa, expect.objectContaining({
          where: { id: 'm1' }, lock: { mode: 'pessimistic_write' }, loadEagerRelations: false,
        }));
        expect(r).toMatchObject({ precio: 4000, unidadesReservadas: 3, estado: 'RESERVADO' });
      });

      it('valida las unidades contra los contadores frescos, no los leídos al inicio', async () => {
        modeloRepo.findOne.mockResolvedValue({ ...existente(), unidades: 3, unidadesReservadas: 0, unidadesVendidas: 0 });
        bloqueo.findOne.mockResolvedValue({ id: 'm1', unidadesReservadas: 2, unidadesVendidas: 0 });
        await expect(service.actualizarModeloCasa('m1', { unidades: 1 }))
          .rejects.toThrow(new BadRequestException('Hay 2 unidades reservadas o vendidas'));
        expect(modeloRepo.save).not.toHaveBeenCalled();
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
      modeloRepo.findOne.mockResolvedValue({ ...existente(), modelo3dUrl: M3D });
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

    it('409 aunque el otro modelo tenga el nombre con otras mayúsculas; cambiar solo mayúsculas del propio sí se permite', async () => {
      modeloRepo.findOne.mockResolvedValueOnce(existente()).mockResolvedValueOnce({ id: 'otro', nombreModelo: 'casa b' });
      await expect(service.actualizarModeloCasa('m1', { nombreModelo: 'Casa B' })).rejects.toBeInstanceOf(ConflictException);

      // "Casa A" -> "CASA A": la búsqueda sin mayúsculas encuentra al mismo modelo m1.
      modeloRepo.findOne.mockReset().mockResolvedValue(existente());
      const r = await service.actualizarModeloCasa('m1', { nombreModelo: 'CASA A' });
      expect(r.nombreModelo).toBe('CASA A');
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
      // Sin distinguir mayúsculas, igual que el índice único de la BD.
      const { nombreModelo } = modeloRepo.findOne.mock.calls[0][0].where;
      expect(nombreModelo.getSql('nombre_modelo')).toBe('LOWER(nombre_modelo) = LOWER(:nombreModelo)');
      expect(nombreModelo.objectLiteralParameters).toEqual({ nombreModelo: 'Casa Z' });
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
      proyecto: { id: 'p1' }, caracteristicas: [{ id: 7 }], imgPrincipal: IMG,
      fotos: [{ id: 'f1', urlImagen: 'https://x/1.jpg', orden: 0 }, { id: 'f2', urlImagen: 'https://x/2.jpg', orden: 1 }],
    });

    it('copia datos, características y fotos como borrador DISPONIBLE con el nombre elegido, en un solo save', async () => {
      modeloRepo.findOne.mockResolvedValueOnce(original()).mockResolvedValueOnce(null);

      const copia = await service.duplicarModeloCasa('m1', 'Casa B');

      // El nombre se busca sin distinguir mayúsculas.
      expect(modeloRepo.findOne.mock.lastCall[0].where.nombreModelo.objectLiteralParameters).toEqual({ nombreModelo: 'Casa B' });
      expect(modeloRepo.save).toHaveBeenCalledTimes(1);
      expect(galeriaRepo.save).not.toHaveBeenCalled();
      const guardado = modeloRepo.save.mock.calls[0][0];
      expect(guardado).toMatchObject({
        nombreModelo: 'Casa B', precio: 3500, activo: false, estado: EstadoModelo.DISPONIBLE,
        unidades: 5, unidadesReservadas: 0, unidadesVendidas: 0,
        proyecto: { id: 'p1' }, caracteristicas: [{ id: 7 }], imgPrincipal: IMG,
      });
      expect(guardado.id).toBeUndefined();
      expect(guardado.creadoEn).toBeUndefined();
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

  describe('eliminarModeloCasa', () => {
    let manager: { findOne: jest.Mock; count: jest.Mock; delete: jest.Mock };
    beforeEach(() => {
      manager = { findOne: jest.fn(async () => ({ id: 'm1', nombreModelo: 'Casa A' })), count: jest.fn(async () => 0), delete: jest.fn() };
      Object.assign(modeloRepo, { manager: { transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)) } });
    });

    it('sin solicitudes lo borra y devuelve su nombre (para la auditoría)', async () => {
      await expect(service.eliminarModeloCasa('m1')).resolves.toEqual({ nombre: 'Casa A' });
      expect(manager.delete).toHaveBeenCalledWith(ModeloCasa, { id: 'm1' });
    });

    it('409 sin borrar nada si tiene solicitudes de clientes', async () => {
      manager.count.mockResolvedValue(2);
      await expect(service.eliminarModeloCasa('m1')).rejects.toThrow('tiene 2 solicitudes de clientes');
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('404 si no existe', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.eliminarModeloCasa('m1')).rejects.toBeInstanceOf(NotFoundException);
      expect(manager.delete).not.toHaveBeenCalled();
    });
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

      const foto = await service.agregarFoto('m1', { urlImagen: FOTO });
      expect(foto).toEqual({ id: 'nuevo-id', urlImagen: FOTO, orden: 3 });
    });

    it('agregarFoto respeta orden 0 explícito', async () => {
      modeloRepo.findOne.mockResolvedValue({ id: 'm1' });
      galeriaRepo.findOne.mockResolvedValue(null);
      galeriaRepo.count.mockResolvedValue(5);

      const foto = await service.agregarFoto('m1', { urlImagen: FOTO, orden: 0 });
      expect(foto.orden).toBe(0);
    });

    it('agregarFoto 409 si la foto ya está en la galería', async () => {
      modeloRepo.findOne.mockResolvedValue({ id: 'm1' });
      galeriaRepo.findOne.mockResolvedValue({ id: 'f1' });
      await expect(
        service.agregarFoto('m1', { urlImagen: FOTO }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('agregarFoto 404 si el modelo no existe', async () => {
      modeloRepo.findOne.mockResolvedValue(null);
      await expect(
        service.agregarFoto('m1', { urlImagen: FOTO }),
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
