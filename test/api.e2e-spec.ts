import { Test } from '@nestjs/testing';
import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getDataSourceToken } from '@nestjs/typeorm';
import { getStorageToken, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from './../src/app.module';
import { configurarApp } from './../src/app.setup';
import { Usuario } from '../src/modules/usuario/entities/usuario.entity';
import { Rol } from '../src/modules/rol/entities/rol.entity';
import { Proyecto } from '../src/modules/proyecto/entities/proyecto.entity';
import { Ciudad } from '../src/modules/ubicacion/entities/ciudad.entity';
import { Region } from '../src/modules/ubicacion/entities/region.entity';
import { ModeloCasa } from '../src/modules/modeloCasa/entities/modeloCasa.entity';
import { Solicitud } from '../src/modules/solicitud/entities/solicitud.entity';
import { Auditoria } from '../src/modules/auditoria/entities/auditoria.entity';
import { NormativaProyecto } from '../src/modules/proyecto/entities/normativaProyecto.entity';
import { EntornoService } from '../src/modules/proyecto/entorno.service';

// Variables propias del test: no dependemos del .env ni de la BD/S3 reales.
Object.assign(process.env, {
  JWT_SECRET: 'test-secret',
  AWS_S3_BUCKET: 'bucket-test',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'AKIATEST',
  AWS_SECRET_ACCESS_KEY: 'secret',
  CORS_ORIGINS: 'http://localhost:3000,https://inmocap.cl',
  DB_SSL: 'false',
});
delete process.env.AWS_SESSION_TOKEN;

type MockRepo = Record<
  'find' | 'findOne' | 'findBy' | 'findAndCount' | 'count' | 'create' | 'save' | 'remove' | 'delete' | 'update' | 'createQueryBuilder',
  jest.Mock
>;

const UUID = '11111111-1111-4111-8111-111111111111';
const repos = new Map<unknown, MockRepo>();
const queryBuilder = { delete: jest.fn(), where: jest.fn(), execute: jest.fn() };
queryBuilder.delete.mockReturnValue(queryBuilder);
queryBuilder.where.mockReturnValue(queryBuilder);

function repo(entity: unknown): MockRepo {
  if (!repos.has(entity)) {
    repos.set(entity, {
      find: jest.fn(),
      findOne: jest.fn(),
      findBy: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: x.id ?? UUID })),
      remove: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilder),
    });
  }
  return repos.get(entity)!;
}

const fakeDataSource = {
  options: { type: 'postgres' },
  entityMetadatas: [],
  isInitialized: true,
  manager: {},
  getRepository: (entity: unknown) => repo(entity),
  query: jest.fn(),
  destroy: jest.fn(),
};

// Usuarios que existen en la "BD": JwtStrategy los consulta en cada petición autenticada
const usuarios: Record<string, Partial<Usuario>> = {
  'admin-id': { id: 'admin-id', correo: 'admin@x.cl', activo: true, rol: { id: 1, nombre: 'ADMIN' } },
  'sec-id': { id: 'sec-id', correo: 'sec@x.cl', activo: true, rol: { id: 2, nombre: 'SECRETARIO' } },
  'inactivo-id': { id: 'inactivo-id', correo: 'baja@x.cl', activo: false, rol: { id: 1, nombre: 'ADMIN' } },
};

// Los tests no consultan OpenStreetMap real
const entornoMock = { calcular: jest.fn() };
const ENTORNO = { radio: 1000, lugares: [], resumen: { transporte: 2, educacion: 5, salud: 1, comercio: 3, areasVerdes: 4 } };

const esperarAuditoria = () => new Promise((resolve) => setImmediate(resolve));

// Rate limit: cada test usa un almacenamiento nuevo, así los contadores parten en cero
let rateLimit = new ThrottlerStorageService();
const rateLimitPorTest = {
  increment: (...args: Parameters<ThrottlerStorageService['increment']>) => rateLimit.increment(...args),
};

describe('API (e2e, BD simulada)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let secretarioToken: string;
  let inactivoToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(fakeDataSource)
      .overrideProvider(getStorageToken())
      .useValue(rateLimitPorTest)
      .overrideProvider(EntornoService)
      .useValue(entornoMock)
      .compile();

    app = moduleFixture.createNestApplication();
    configurarApp(app);
    await app.init();

    const jwt = app.get(JwtService);
    adminToken = jwt.sign({ sub: 'admin-id', correo: 'admin@x.cl', rol: 'ADMIN' });
    secretarioToken = jwt.sign({ sub: 'sec-id', correo: 'sec@x.cl', rol: 'SECRETARIO' });
    inactivoToken = jwt.sign({ sub: 'inactivo-id', correo: 'baja@x.cl', rol: 'ADMIN' });
  });

  afterAll(async () => {
    await app.close();
    rateLimit.onApplicationShutdown();
  });

  beforeEach(() => {
    for (const r of repos.values()) {
      r.find.mockReset().mockResolvedValue([]);
      r.findOne.mockReset().mockResolvedValue(null);
      r.findBy.mockReset().mockResolvedValue([]);
      r.findAndCount.mockReset().mockResolvedValue([[], 0]);
      r.count.mockReset().mockResolvedValue(0);
      r.delete.mockReset().mockResolvedValue({ affected: 1 });
      r.save.mockClear();
    }
    repo(Usuario).findOne.mockImplementation(async ({ where }) =>
      where?.id ? usuarios[where.id] ?? null : null,
    );
    queryBuilder.execute.mockReset().mockResolvedValue({ affected: 0 });
    fakeDataSource.query.mockReset().mockResolvedValue([{ '?column?': 1 }]);
    entornoMock.calcular.mockReset().mockResolvedValue(ENTORNO);
    for (const r of repos.values()) r.update?.mockReset();
    rateLimit.onApplicationShutdown();
    rateLimit = new ThrottlerStorageService();
  });

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('GET /api responde', () => http().get('/api').expect(200).expect('Hello World!'));

  describe('cabeceras y CORS', () => {
    it('envía cabeceras de seguridad (helmet) y no expone X-Powered-By', async () => {
      const res = await http().get('/api').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('permite los orígenes configurados', async () => {
      const res = await http().get('/api').set('Origin', 'https://inmocap.cl').expect(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://inmocap.cl');
    });

    it('no habilita CORS para otros orígenes', async () => {
      const res = await http().get('/api').set('Origin', 'https://atacante.com');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('salud y documentación', () => {
    it('GET /api/health -> 200 con la BD conectada', async () => {
      const res = await http().get('/api/health').expect(200);
      expect(res.body).toMatchObject({ estado: 'ok', baseDatos: 'ok' });
    });

    it('GET /api/health -> 503 si la BD no responde', async () => {
      fakeDataSource.query.mockRejectedValue(new Error('caída'));
      await http().get('/api/health').expect(503);
    });

    it('GET /api/docs-json publica el OpenAPI con autenticación Bearer', async () => {
      const res = await http().get('/api/docs-json').expect(200);
      expect(res.body.info.title).toBe('Inmocap API');
      expect(res.body.components.securitySchemes.bearer).toBeDefined();
      expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(['/api/auth/login', '/api/solicitudes']));
    });

    it('GET /api/docs sirve la interfaz de Swagger', () => http().get('/api/docs').expect(200));
  });

  describe('auth', () => {
    it('login con body inválido -> 400', () =>
      http().post('/api/auth/login').send({ correo: 'no-es-correo' }).expect(400));

    it('login con credenciales incorrectas -> 401 y queda auditado sin la contraseña', async () => {
      await http().post('/api/auth/login').send({ correo: 'a@a.cl', contrasena: 'clave-secreta' }).expect(401);
      await esperarAuditoria();
      const registro = repo(Auditoria).save.mock.calls.at(-1)![0];
      expect(registro).toMatchObject({ accion: 'POST /api/auth/login', estado: 401, exito: false, correo: 'a@a.cl' });
      expect(JSON.stringify(registro)).not.toContain('clave-secreta');
    });

    it('login de usuario desactivado -> 401', async () => {
      repo(Usuario).findOne.mockResolvedValue({
        id: 'x', correo: 'x@x.cl', contrasena: await bcrypt.hash('secreta123', 4),
        activo: false, rol: { nombre: 'ADMIN' },
      });
      await http().post('/api/auth/login').send({ correo: 'x@x.cl', contrasena: 'secreta123' }).expect(401);
    });

    it('login: el 6º intento en un minuto -> 429', async () => {
      for (let i = 0; i < 5; i++) {
        await http().post('/api/auth/login').send({ correo: 'a@a.cl', contrasena: 'x' }).expect(401);
      }
      await http().post('/api/auth/login').send({ correo: 'a@a.cl', contrasena: 'x' }).expect(429);
    });

    it('login correcto -> token utilizable en rutas protegidas', async () => {
      const admin = { ...usuarios['admin-id'], contrasena: await bcrypt.hash('secreta123', 4) };
      repo(Usuario).findOne.mockResolvedValue(admin);

      const res = await http()
        .post('/api/auth/login')
        .send({ correo: 'admin@x.cl', contrasena: 'secreta123' })
        .expect(201);

      expect(res.body.usuario).toEqual({ id: 'admin-id', correo: 'admin@x.cl', rol: 'ADMIN' });
      expect(res.body.usuario.contrasena).toBeUndefined();

      repo(Ciudad).findOne.mockResolvedValue({ id: 1, nombre: 'Temuco' });
      await http()
        .post('/api/proyectos')
        .set(auth(res.body.access_token))
        .send({ nombre: 'P', id_ciudad: 1, descripcion: 'd', imagenPortada: 'https://x/p.jpg' })
        .expect(201);
    });

    const nuevoUsuario = { correo: 'n@x.cl', contrasena: 'Inmocap2026', nombre: 'N', rol: 'ADMIN' };

    it('registrar sin token -> 401', () =>
      http().post('/api/auth/registrar').send(nuevoUsuario).expect(401));

    it('registrar con token de SECRETARIO -> 403', () =>
      http().post('/api/auth/registrar').set(auth(secretarioToken)).send(nuevoUsuario).expect(403));

    it('registrar con contraseña débil -> 400', () =>
      http()
        .post('/api/auth/registrar')
        .set(auth(adminToken))
        .send({ ...nuevoUsuario, contrasena: '12345678' })
        .expect(400));

    it('registrar con token de ADMIN -> 201', async () => {
      repo(Rol).findOne.mockResolvedValue({ id: 1, nombre: 'ADMIN' });
      const res = await http().post('/api/auth/registrar').set(auth(adminToken)).send(nuevoUsuario).expect(201);
      expect(res.body.usuario.rol).toBe('ADMIN');
    });

    it('token con firma inválida -> 401', () =>
      http().post('/api/proyectos').set(auth(`${adminToken.slice(0, -2)}xx`)).send({}).expect(401));

    it('token válido de un usuario desactivado -> 401', () =>
      http().get('/api/solicitudes').set(auth(inactivoToken)).expect(401));

    it('si a un usuario le quitan el rol ADMIN, su token deja de servir para rutas ADMIN', async () => {
      repo(Usuario).findOne.mockResolvedValue({ ...usuarios['admin-id'], rol: { id: 2, nombre: 'SECRETARIO' } });
      await http().post('/api/auth/registrar').set(auth(adminToken)).send(nuevoUsuario).expect(403);
    });
  });

  describe('rutas públicas', () => {
    it('GET /api/ubicacion/regiones', async () => {
      repo(Region).find.mockResolvedValue([{ id: 1, nombre: 'Maule' }]);
      const res = await http().get('/api/ubicacion/regiones').expect(200);
      expect(res.body).toEqual([{ id: 1, nombre: 'Maule' }]);
    });

    it('GET /api/ubicacion/ciudades?id_region=abc -> 400', () =>
      http().get('/api/ubicacion/ciudades?id_region=abc').expect(400));

    it('GET /api/proyectos/:id con id no UUID -> 400', () =>
      http().get('/api/proyectos/123').expect(400));

    it('GET /api/proyectos/:id inexistente -> 404', () =>
      http().get(`/api/proyectos/${UUID}`).expect(404));

    it('GET /api/modeloCasa?tipoOperacion=OTRO -> 400', () =>
      http().get('/api/modeloCasa?tipoOperacion=OTRO').expect(400));

    it('GET /api/modeloCasa?tipoOperacion=VENTA -> 200', async () => {
      await http().get('/api/modeloCasa?tipoOperacion=VENTA').expect(200);
      expect(repo(ModeloCasa).find.mock.calls[0][0].where.tipoOperacion).toBe('VENTA');
    });

    it('GET /api/caracteristicas -> 200', () => http().get('/api/caracteristicas').expect(200));

    it('las lecturas públicas normales no se auditan', async () => {
      repo(Auditoria).save.mockClear();
      await http().get('/api/caracteristicas').expect(200);
      await esperarAuditoria();
      expect(repo(Auditoria).save).not.toHaveBeenCalled();
    });
  });

  describe('buscador de modelos', () => {
    const where = () => repo(ModeloCasa).find.mock.calls[0][0].where;

    it('convierte los filtros del query string a números y booleanos', async () => {
      await http()
        .get('/api/modeloCasa?tipoOperacion=VENTA&moneda=UF&precioMin=2000&precioMax=4000&dormitorios=3&banos=2&superficieMin=80&mascotas=true&id_region=7&orden=precio_asc')
        .expect(200);
      const w = where();
      expect(w).toMatchObject({ tipoOperacion: 'VENTA', moneda: 'UF', mascotas: true });
      expect(w.precio).toMatchObject({ type: 'between', value: [2000, 4000] });
      expect(w.dormitorios).toMatchObject({ value: 3 });
      expect(w.proyecto).toEqual({ activo: true, ciudad: { region: { id: 7 } } });
      expect(repo(ModeloCasa).find.mock.calls[0][0].order).toMatchObject({ precio: 'ASC' });
    });

    it('mascotas=false se respeta (no se confunde con "sin filtro")', async () => {
      await http().get('/api/modeloCasa?mascotas=false').expect(200);
      expect(where().mascotas).toBe(false);
    });

    it.each([
      ['precioMin=abc'],
      ['dormitorios=-1'],
      ['orden=caro'],
      ['moneda=USD'],
      ['id_proyecto=no-uuid'],
      ['mascotas=quizas'],
    ])('filtro inválido %s -> 400', (q) => http().get(`/api/modeloCasa?${q}`).expect(400));
  });

  describe('proyectos: ubicación y normativa', () => {
    it('crear proyecto sin descripción ahora es válido', async () => {
      repo(Ciudad).findOne.mockResolvedValue({ id: 1 });
      await http().post('/api/proyectos').set(auth(adminToken))
        .send({ nombre: 'P', id_ciudad: 1, imagenPortada: 'https://x/p.jpg' }).expect(201);
    });

    it('PATCH ubicación con ADMIN -> 200; coordenadas fuera de rango -> 400', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID, ciudad: { id: 1 } });
      const res = await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken))
        .send({ direccion: '1 Sur 1234, Talca', latitud: -35.4264, longitud: -71.6554 }).expect(200);
      expect(res.body).toMatchObject({ latitud: -35.4264, longitud: -71.6554 });

      await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken)).send({ latitud: -95 }).expect(400);
    });

    it('cambiar las coordenadas recalcula el entorno en segundo plano', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID, latitud: null, longitud: null, ciudad: { id: 1 } });
      await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken)).send({ latitud: -35.4, longitud: -71.6 }).expect(200);
      await esperarAuditoria();
      expect(entornoMock.calcular).toHaveBeenCalledWith(-35.4, -71.6);
      expect(repo(Proyecto).update).toHaveBeenCalledWith({ id: UUID }, expect.objectContaining({ entorno: ENTORNO }));
    });

    it('GET entorno es público; 404 si aún no se calculó', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID, entorno: null, entornoActualizadoEn: null });
      await http().get(`/api/proyectos/${UUID}/entorno`).expect(404);
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID, entorno: ENTORNO, entornoActualizadoEn: new Date('2026-10-25') });
      const res = await http().get(`/api/proyectos/${UUID}/entorno`).expect(200);
      expect(res.body.entorno.resumen.educacion).toBe(5);
    });

    it('POST entorno (ADMIN) recalcula; 400 sin coordenadas; 503 si OpenStreetMap no responde; 403 sin ser ADMIN', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID, latitud: -35.4, longitud: -71.6 });
      await http().post(`/api/proyectos/${UUID}/entorno`).set(auth(adminToken)).expect(201);

      entornoMock.calcular.mockRejectedValueOnce(new ServiceUnavailableException());
      await http().post(`/api/proyectos/${UUID}/entorno`).set(auth(adminToken)).expect(503);

      repo(Proyecto).findOne.mockResolvedValue({ id: UUID, latitud: null, longitud: null });
      await http().post(`/api/proyectos/${UUID}/entorno`).set(auth(adminToken)).expect(400);

      await http().post(`/api/proyectos/${UUID}/entorno`).set(auth(secretarioToken)).expect(403);
    });

    it('PATCH sin ser ADMIN -> 403', () =>
      http().patch(`/api/proyectos/${UUID}`).set(auth(secretarioToken)).send({ nombre: 'X' }).expect(403));

    it('DELETE despublica el proyecto; inexistente -> 404; SECRETARIO -> 403', async () => {
      repo(Proyecto).update.mockResolvedValue({ affected: 1 });
      await http().delete(`/api/proyectos/${UUID}`).set(auth(adminToken)).expect(200);
      expect(repo(Proyecto).update).toHaveBeenCalledWith({ id: UUID, activo: true }, { activo: false });

      repo(Proyecto).update.mockResolvedValue({ affected: 0 });
      await http().delete(`/api/proyectos/${UUID}`).set(auth(adminToken)).expect(404);
      await http().delete(`/api/proyectos/${UUID}`).set(auth(secretarioToken)).expect(403);
    });

    const normativa = {
      instrumento: 'Plan Regulador Comunal de Talca', zona: 'ZH-2', usosPermitidos: 'Residencial y equipamiento menor',
      alturaMaximaPisos: 4, alturaMaximaMetros: 14, densidadMaxima: 400, coefConstructibilidad: 1.6,
      coefOcupacionSuelo: 0.6, riesgos: ['INUNDACION'], urlOrdenanza: 'https://www.talca.cl/prc.pdf',
      fechaConsulta: '2026-10-01',
    };

    it('GET normativa es público; 404 si no hay ficha', async () => {
      await http().get(`/api/proyectos/${UUID}/normativa`).expect(404);
      repo(NormativaProyecto).findOne.mockResolvedValue({ id: 'n1', ...normativa });
      const res = await http().get(`/api/proyectos/${UUID}/normativa`).expect(200);
      expect(res.body.zona).toBe('ZH-2');
    });

    it('PUT normativa con ADMIN -> 200', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID });
      repo(NormativaProyecto).findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'n1', ...normativa });
      await http().put(`/api/proyectos/${UUID}/normativa`).set(auth(adminToken)).send(normativa).expect(200);
      expect(repo(NormativaProyecto).save).toHaveBeenCalled();
    });

    it.each([
      ['riesgo desconocido', { riesgos: ['ALIENS'] }],
      ['ocupación de suelo > 1', { coefOcupacionSuelo: 1.5 }],
      ['fecha inválida', { fechaConsulta: '01-10-2026' }],
      ['URL sin protocolo', { urlOrdenanza: 'talca.cl/prc.pdf' }],
      ['sin zona', { zona: '' }],
    ])('PUT normativa con %s -> 400', (_caso, cambio) =>
      http().put(`/api/proyectos/${UUID}/normativa`).set(auth(adminToken)).send({ ...normativa, ...cambio }).expect(400));

    it('PUT normativa sin ser ADMIN -> 403', () =>
      http().put(`/api/proyectos/${UUID}/normativa`).set(auth(secretarioToken)).send(normativa).expect(403));
  });

  describe('modelos de casa (ADMIN)', () => {
    const body = {
      id_proyecto: UUID,
      nombreModelo: 'Casa A',
      tipoOperacion: 'VENTA',
      dormitorios: 3,
      banos: 2,
      estacionamiento: 1,
      mascotas: true,
      superficieConstruida: 90.5,
      superficieTerreno: 200,
      precio: 3500,
      moneda: 'UF',
      modelo3dUrl: 'https://x/m.glb',
      imgPrincipal: 'https://x/i.jpg',
      caracteristicasID: [],
    };

    it('crea el modelo, descarta campos extra y lo audita con el usuario', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID });
      await http().post('/api/modeloCasa').set(auth(adminToken)).send({ ...body, campoExtra: 'se descarta' }).expect(201);

      const guardado = repo(ModeloCasa).save.mock.calls[0][0];
      expect(guardado.gastosComunes).toBe(false);
      expect(guardado.estacionamientos).toBe(1);
      expect(guardado).not.toHaveProperty('campoExtra');

      await esperarAuditoria();
      expect(repo(Auditoria).save).toHaveBeenCalledWith(expect.objectContaining({
        accion: 'POST /api/modeloCasa', estado: 201, exito: true, idUsuario: 'admin-id', rol: 'ADMIN',
      }));
    });

    it('nombre duplicado -> 409', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID });
      repo(ModeloCasa).findOne.mockResolvedValue({ id: 'otro' });
      await http().post('/api/modeloCasa').set(auth(adminToken)).send(body).expect(409);
    });

    it('caracteristicas inexistentes -> 400', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID });
      await http().post('/api/modeloCasa').set(auth(adminToken)).send({ ...body, caracteristicasID: [7] }).expect(400);
    });

    it('nombreModelo de hasta 150 caracteres es válido; 151 -> 400', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID });
      await http().post('/api/modeloCasa').set(auth(adminToken)).send({ ...body, nombreModelo: 'a'.repeat(150) }).expect(201);
      await http().post('/api/modeloCasa').set(auth(adminToken)).send({ ...body, nombreModelo: 'a'.repeat(151) }).expect(400);
    });

    it('body inválido -> 400', () =>
      http().post('/api/modeloCasa').set(auth(adminToken)).send({ ...body, banos: 0, moneda: 'USD' }).expect(400));

    it('crear sin modelo 3D -> 201 con modelo3dUrl null', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID });
      const { modelo3dUrl: _sin3d, ...sin3d } = body;
      await http().post('/api/modeloCasa').set(auth(adminToken)).send(sin3d).expect(201);
      expect(repo(ModeloCasa).save.mock.calls[0][0].modelo3dUrl).toBeNull();
    });

    it('PATCH con ADMIN actualiza solo lo enviado; body inválido -> 400; SECRETARIO -> 403', async () => {
      repo(ModeloCasa).findOne.mockResolvedValue({ id: UUID, nombreModelo: 'Casa A', precio: 3500, caracteristicas: [] });
      const res = await http().patch(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).send({ precio: 3900, modelo3dUrl: null }).expect(200);
      expect(res.body).toMatchObject({ nombreModelo: 'Casa A', precio: 3900, modelo3dUrl: null });

      await http().patch(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).send({ moneda: 'USD' }).expect(400);
      await http().patch(`/api/modeloCasa/${UUID}`).set(auth(secretarioToken)).send({ precio: 1 }).expect(403);
    });

    it('PATCH de modelo inexistente -> 404', () =>
      http().patch(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).send({ precio: 1 }).expect(404));

    it('PATCH estado y publicar: valida el estado', async () => {
      repo(ModeloCasa).findOne.mockResolvedValue({ id: UUID, nombreModelo: 'Casa A', activo: false, caracteristicas: [] });
      const res = await http().patch(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).send({ estado: 'RESERVADO', activo: true }).expect(200);
      expect(res.body).toMatchObject({ estado: 'RESERVADO', activo: true });
      await http().patch(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).send({ estado: 'ARRENDADO' }).expect(400);
    });

    it('GET /admin lista también borradores; solo ADMIN', async () => {
      repo(ModeloCasa).find.mockResolvedValue([{ id: UUID, activo: false }]);
      const res = await http().get('/api/modeloCasa/admin').set(auth(adminToken)).expect(200);
      expect(res.body).toEqual([{ id: UUID, activo: false }]);
      expect(repo(ModeloCasa).find.mock.calls[0][0].where).toBeUndefined();
      await http().get('/api/modeloCasa/admin').set(auth(secretarioToken)).expect(403);
      await http().get('/api/modeloCasa/admin').expect(401);
    });

    it('GET /admin/:id devuelve un borrador; inexistente -> 404', async () => {
      repo(ModeloCasa).findOne.mockResolvedValueOnce({ id: UUID, activo: false });
      await http().get(`/api/modeloCasa/admin/${UUID}`).set(auth(adminToken)).expect(200);
      await http().get(`/api/modeloCasa/admin/${UUID}`).set(auth(adminToken)).expect(404);
    });

    it('DELETE despublica (borrado lógico); inexistente -> 404; SECRETARIO -> 403', async () => {
      repo(ModeloCasa).update.mockResolvedValue({ affected: 1 });
      await http().delete(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).expect(200);
      expect(repo(ModeloCasa).update).toHaveBeenCalledWith({ id: UUID, activo: true }, { activo: false });
      expect(repo(ModeloCasa).delete).not.toHaveBeenCalled();

      repo(ModeloCasa).update.mockResolvedValue({ affected: 0 });
      await http().delete(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).expect(404);
      await http().delete(`/api/modeloCasa/${UUID}`).set(auth(secretarioToken)).expect(403);
    });

    it('SECRETARIO no puede crear -> 403 y el rechazo queda auditado', async () => {
      await http().post('/api/modeloCasa').set(auth(secretarioToken)).send(body).expect(403);
      await esperarAuditoria();
      expect(repo(Auditoria).save).toHaveBeenCalledWith(expect.objectContaining({
        estado: 403, exito: false, idUsuario: 'sec-id',
      }));
    });
  });

  describe('usuarios (ADMIN)', () => {
    const nuevo = { correo: 'nuevo@x.cl', nombre: 'Nuevo', rol: 'SECRETARIO', contrasena: 'Secreta12345' };

    it('GET lista sin contraseñas; SECRETARIO -> 403', async () => {
      repo(Usuario).find.mockResolvedValue([{ id: 'sec-id', correo: 'sec@x.cl', contrasena: 'hash', activo: true }]);
      const res = await http().get('/api/usuarios').set(auth(adminToken)).expect(200);
      expect(res.body[0]).not.toHaveProperty('contrasena');
      await http().get('/api/usuarios').set(auth(secretarioToken)).expect(403);
    });

    it('POST crea un secretario sin devolver el hash; contraseña débil -> 400', async () => {
      repo(Rol).findOne.mockResolvedValue({ id: 2, nombre: 'SECRETARIO' });
      const res = await http().post('/api/usuarios').set(auth(adminToken)).send(nuevo).expect(201);
      expect(res.body).toMatchObject({ correo: 'nuevo@x.cl', rol: { nombre: 'SECRETARIO' } });
      expect(res.body).not.toHaveProperty('contrasena');
      expect(res.body).not.toHaveProperty('access_token');
      await http().post('/api/usuarios').set(auth(adminToken)).send({ ...nuevo, contrasena: 'corta' }).expect(400);
    });

    it('PATCH desactiva a otro usuario; a sí mismo -> 400; SECRETARIO -> 403', async () => {
      const uid = '22222222-2222-4222-8222-222222222222';
      repo(Usuario).findOne.mockImplementation(async ({ where }) =>
        where?.id === uid ? { id: uid, contrasena: 'hash', activo: true } : usuarios[where?.id] ?? null);
      const res = await http().patch(`/api/usuarios/${uid}`).set(auth(adminToken)).send({ activo: false }).expect(200);
      expect(res.body).toEqual({ id: uid, activo: false });

      // El propio admin (sub con formato UUID para pasar ParseUUIDPipe)
      repo(Usuario).findOne.mockResolvedValue({ id: uid, correo: 'yo@x.cl', activo: true, rol: { nombre: 'ADMIN' } });
      const yo = app.get(JwtService).sign({ sub: uid, correo: 'yo@x.cl', rol: 'ADMIN' });
      const propio = await http().patch(`/api/usuarios/${uid}`).set(auth(yo)).send({ activo: false }).expect(400);
      expect(propio.body.message).toMatch(/propia cuenta/);

      repo(Usuario).findOne.mockImplementation(async ({ where }) => usuarios[where?.id] ?? null);
      await http().patch(`/api/usuarios/${uid}`).set(auth(secretarioToken)).send({ activo: false }).expect(403);
    });

    it('PATCH me/contrasena: el SECRETARIO cambia la suya con la actual correcta', async () => {
      const hash = await bcrypt.hash('Actual12345', 4);
      repo(Usuario).findOne.mockImplementation(async ({ where }) => ({ ...usuarios[where?.id], contrasena: hash }));
      await http().patch('/api/usuarios/me/contrasena').set(auth(secretarioToken)).send({ actual: 'Mala1234567', nueva: 'Nueva123456' }).expect(400);
      await http().patch('/api/usuarios/me/contrasena').set(auth(secretarioToken)).send({ actual: 'Actual12345', nueva: 'debil' }).expect(400);
      await http().patch('/api/usuarios/me/contrasena').set(auth(secretarioToken)).send({ actual: 'Actual12345', nueva: 'Nueva123456' }).expect(200);
      expect(repo(Usuario).save).toHaveBeenCalledWith(expect.objectContaining({ id: 'sec-id' }));
    });
  });

  describe('métricas', () => {
    it('GET con ADMIN -> 200; SECRETARIO -> 403', async () => {
      const qb = { innerJoin: jest.fn(), select: jest.fn(), addSelect: jest.fn(), groupBy: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), getRawMany: jest.fn().mockResolvedValue([]) };
      for (const m of ['innerJoin', 'select', 'addSelect', 'groupBy', 'orderBy', 'limit'] as const) qb[m].mockReturnValue(qb);
      repo(Solicitud).createQueryBuilder.mockReturnValueOnce(qb);
      const res = await http().get('/api/metricas').set(auth(adminToken)).expect(200);
      expect(res.body).toMatchObject({ solicitudes: { pendientes: 0 }, modelos: { publicados: 0 }, masSolicitados: [] });
      await http().get('/api/metricas').set(auth(secretarioToken)).expect(403);
    });
  });

  describe('solicitudes', () => {
    const body = {
      nombre: 'Juan', apellido: 'Pérez', correo: 'j@p.cl', celular: '+56911111111',
      mensaje: 'Me interesa', id_modelo_casa: UUID, aceptaPrivacidad: true,
    };

    it('POST público crea la solicitud con mensaje y fecha de consentimiento', async () => {
      repo(ModeloCasa).findOne.mockResolvedValue({ id: UUID });
      const res = await http().post('/api/solicitudes').send(body).expect(201);
      expect(res.body.mensaje).toBe('Me interesa');
      expect(res.body).not.toHaveProperty('mensjae');
      expect(new Date(res.body.consentimientoEn).getTime()).not.toBeNaN();
    });

    it.each([
      ['sin aceptar la política', { aceptaPrivacidad: undefined }],
      ['rechazando la política', { aceptaPrivacidad: false }],
      ['con correo inválido', { correo: 'x' }],
    ])('POST %s -> 400', async (_caso, cambio) => {
      repo(ModeloCasa).findOne.mockResolvedValue({ id: UUID });
      await http().post('/api/solicitudes').send({ ...body, ...cambio }).expect(400);
    });

    it('POST con modelo inexistente -> 404', () =>
      http().post('/api/solicitudes').send(body).expect(404));

    it('POST: el 6º envío en un minuto desde la misma IP -> 429', async () => {
      repo(ModeloCasa).findOne.mockResolvedValue({ id: UUID });
      for (let i = 0; i < 5; i++) {
        await http().post('/api/solicitudes').send(body).expect(201);
      }
      await http().post('/api/solicitudes').send(body).expect(429);
    });

    it('GET sin token -> 401', () => http().get('/api/solicitudes').expect(401));

    it('GET con SECRETARIO -> 200', () =>
      http().get('/api/solicitudes').set(auth(secretarioToken)).expect(200));

    it('GET con ADMIN -> 200', () =>
      http().get('/api/solicitudes').set(auth(adminToken)).expect(200));

    it('PATCH contactado con SECRETARIO -> 200', async () => {
      repo(Solicitud).findOne.mockResolvedValue({ id: UUID, contactado: false });
      const res = await http().patch(`/api/solicitudes/${UUID}/contactado`).set(auth(secretarioToken)).expect(200);
      expect(res.body.contactado).toBe(true);
    });

    it('PATCH contactado con ADMIN -> 200', async () => {
      repo(Solicitud).findOne.mockResolvedValue({ id: UUID, contactado: false });
      await http().patch(`/api/solicitudes/${UUID}/contactado`).set(auth(adminToken)).expect(200);
    });

    describe('derecho de supresión', () => {
      it('DELETE /:id con ADMIN -> 200; inexistente -> 404', async () => {
        await http().delete(`/api/solicitudes/${UUID}`).set(auth(adminToken)).expect(200);
        repo(Solicitud).delete.mockResolvedValue({ affected: 0 });
        await http().delete(`/api/solicitudes/${UUID}`).set(auth(adminToken)).expect(404);
      });

      it('DELETE ?correo= borra todas las solicitudes de esa persona', async () => {
        queryBuilder.execute.mockResolvedValue({ affected: 3 });
        const res = await http().delete('/api/solicitudes?correo=j@p.cl').set(auth(adminToken)).expect(200);
        expect(res.body).toEqual({ eliminadas: 3 });
      });

      it('DELETE sin correo válido -> 400', () =>
        http().delete('/api/solicitudes?correo=x').set(auth(adminToken)).expect(400));

      it('SECRETARIO no puede borrar -> 403', () =>
        http().delete(`/api/solicitudes/${UUID}`).set(auth(secretarioToken)).expect(403));
    });
  });

  describe('auditoría', () => {
    it('GET /api/auditoria solo para ADMIN, paginado', async () => {
      repo(Auditoria).findAndCount.mockResolvedValue([[{ id: 'a1' }], 1]);
      const res = await http().get('/api/auditoria?pagina=2&limite=500').set(auth(adminToken)).expect(200);
      expect(res.body).toEqual({ registros: [{ id: 'a1' }], total: 1, pagina: 2, limite: 200 });
      expect(repo(Auditoria).findAndCount).toHaveBeenCalledWith({ order: { fecha: 'DESC' }, skip: 200, take: 200 });

      await http().get('/api/auditoria').set(auth(secretarioToken)).expect(403);
    });

    it('si falla guardar la auditoría, la petición igual responde', async () => {
      repo(Auditoria).save.mockRejectedValueOnce(new Error('BD caída'));
      repo(ModeloCasa).findOne.mockResolvedValue({ id: UUID });
      await http().post('/api/solicitudes').send({
        nombre: 'A', apellido: 'B', correo: 'a@b.cl', celular: '1', id_modelo_casa: UUID, aceptaPrivacidad: true,
      }).expect(201);
      await esperarAuditoria();
    });
  });

  describe('s3', () => {
    const archivo = { archivo: 'a.jpg', contentType: 'image/jpeg', tamano: 1000, carpeta: 'proyectos' };

    it('presigned-url con carpeta inválida -> 400', () =>
      http().post('/api/s3/presigned-url').set(auth(adminToken)).send({ ...archivo, carpeta: 'otra' }).expect(400));

    it('presigned-url sin tamaño -> 400', () =>
      http().post('/api/s3/presigned-url').set(auth(adminToken)).send({ ...archivo, tamano: undefined }).expect(400));

    it('presigned-url con tipo no permitido -> 400', () =>
      http().post('/api/s3/presigned-url').set(auth(adminToken)).send({ ...archivo, contentType: 'text/html' }).expect(400));

    it('presigned-url con archivo demasiado grande -> 413', () =>
      http().post('/api/s3/presigned-url').set(auth(adminToken)).send({ ...archivo, tamano: 11 * 1024 * 1024 }).expect(413));

    it('presigned-url sin token -> 401', () =>
      http().post('/api/s3/presigned-url').send(archivo).expect(401));

    it('presigned-url con ADMIN -> 201 con uploadUrl firmado', async () => {
      const res = await http().post('/api/s3/presigned-url').set(auth(adminToken)).send(archivo).expect(201);
      expect(res.body.key).toMatch(/^proyectos\/.+\.jpg$/);
      expect(res.body.uploadUrl).toContain('X-Amz-Signature=');
      expect(res.body.contentType).toBe('image/jpeg');
    });
  });
});
