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
import { GaleriaModeloCasa } from '../src/modules/modeloCasa/entities/galeriaModeloCasa.entity';
import { Solicitud } from '../src/modules/solicitud/entities/solicitud.entity';
import { Reserva } from '../src/modules/reserva/entities/reserva.entity';
import { Auditoria } from '../src/modules/auditoria/entities/auditoria.entity';
import { NormativaProyecto } from '../src/modules/proyecto/entities/normativaProyecto.entity';
import { EntornoService } from '../src/modules/proyecto/entorno.service';
import { EventoModelo } from '../src/modules/metricas/entities/eventoModelo.entity';

// Variables propias del test: no dependemos del .env ni de la BD/S3 reales.
Object.assign(process.env, {
  JWT_SECRET: 'test-secret',
  AWS_S3_BUCKET: 'bucket-test',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'AKIATEST',
  AWS_SECRET_ACCESS_KEY: 'secret',
  CORS_ORIGINS: 'http://localhost:3000,https://inmocap.cl',
  DB_SSL: 'false',
  SWAGGER: 'true',
});
delete process.env.AWS_SESSION_TOKEN;

type MockRepo = Record<
  'find' | 'findOne' | 'findBy' | 'findAndCount' | 'count' | 'exists' | 'create' | 'save' | 'remove' | 'delete' | 'update' | 'createQueryBuilder',
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
      exists: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: x.id ?? UUID })),
      remove: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilder),
    });
    // Transacciones de repository.manager: delegan en los repos simulados de cada entidad
    Object.assign(repos.get(entity)!, { manager: { transaction: (cb: (m: unknown) => unknown) => cb(gestorSimulado) } });
  }
  return repos.get(entity)!;
}

const gestorSimulado = {
  findOne: (entidad: unknown, opciones: unknown) => repo(entidad).findOne(opciones),
  save: (entidad: unknown, datos: unknown) => repo(entidad).save(datos),
};

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

  describe('estado de la base de datos y documentación', () => {
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

    it('login: el 6º intento en un minuto desde la misma IP -> 429', async () => {
      // Un correo distinto en cada intento: así salta el límite por IP y no el bloqueo por cuenta
      for (let i = 0; i < 5; i++) {
        await http().post('/api/auth/login').send({ correo: `ip${i}@a.cl`, contrasena: 'x' }).expect(401);
      }
      await http().post('/api/auth/login').send({ correo: 'ip5@a.cl', contrasena: 'x' }).expect(429);
    });

    it('login: 5 fallos sobre la misma cuenta la bloquean aunque cambie la IP -> 429', async () => {
      for (let i = 0; i < 5; i++) {
        rateLimit = new ThrottlerStorageService(); // simula una IP nueva en cada intento
        await http().post('/api/auth/login').send({ correo: 'bloqueo@a.cl', contrasena: 'x' }).expect(401);
      }
      rateLimit = new ThrottlerStorageService();
      await http().post('/api/auth/login').send({ correo: 'bloqueo@a.cl', contrasena: 'x' }).expect(429);
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

    // Eliminada: devolvía al ADMIN un token del usuario creado (podía actuar en su nombre). Se usa POST /usuarios.
    it('POST /auth/registrar ya no existe -> 404', () =>
      http().post('/api/auth/registrar').set(auth(adminToken)).send(nuevoUsuario).expect(404));

    it('crear usuario sin token -> 401', () =>
      http().post('/api/usuarios').send(nuevoUsuario).expect(401));

    it('crear usuario con token de SECRETARIO -> 403', () =>
      http().post('/api/usuarios').set(auth(secretarioToken)).send(nuevoUsuario).expect(403));

    it('token con firma inválida -> 401', () =>
      http().post('/api/proyectos').set(auth(`${adminToken.slice(0, -2)}xx`)).send({}).expect(401));

    it('token válido de un usuario desactivado -> 401', () =>
      http().get('/api/solicitudes').set(auth(inactivoToken)).expect(401));

    it('si a un usuario le quitan el rol ADMIN, su token deja de servir para rutas ADMIN', async () => {
      repo(Usuario).findOne.mockResolvedValue({ ...usuarios['admin-id'], rol: { id: 2, nombre: 'SECRETARIO' } });
      await http().post('/api/usuarios').set(auth(adminToken)).send(nuevoUsuario).expect(403);
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

    it('crear a menos de 50 m de otro proyecto: 409 con los cercanos; con confirmarCercania -> 201; confirmarCercania no booleano -> 400', async () => {
      repo(Ciudad).findOne.mockResolvedValue({ id: 1 });
      repo(Proyecto).find.mockResolvedValue([{ id: 'otro', nombre: 'Los Robles', activo: true, latitud: -35.4264, longitud: -71.6554 }]);
      const cuerpo = { nombre: 'P', id_ciudad: 1, imagenPortada: 'https://x/p.jpg', latitud: -35.4265, longitud: -71.6554 };
      const res = await http().post('/api/proyectos').set(auth(adminToken)).send(cuerpo).expect(409);
      expect(res.body).toMatchObject({ statusCode: 409, cercanos: [{ id: 'otro', nombre: 'Los Robles', distancia: 11 }] });
      expect(res.body.message).toContain('«Los Robles»');

      await http().post('/api/proyectos').set(auth(adminToken)).send({ ...cuerpo, confirmarCercania: true }).expect(201);
      await http().post('/api/proyectos').set(auth(adminToken)).send({ ...cuerpo, confirmarCercania: 'si' }).expect(400);
    });

    it('PATCH ubicación con ADMIN -> 200; coordenadas fuera de rango -> 400', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID, ciudad: { id: 1 } });
      const res = await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken))
        .send({ direccion: '1 Sur 1234, Talca', latitud: -35.4264, longitud: -71.6554 }).expect(200);
      expect(res.body).toMatchObject({ latitud: -35.4264, longitud: -71.6554 });

      await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken)).send({ latitud: -95 }).expect(400);
    });

    it('PATCH etapa y fecha de entrega; valores inválidos -> 400; null las borra', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID, ciudad: { id: 1 } });
      const res = await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken))
        .send({ etapa: 'EN_VERDE', fechaEntrega: '2027-12-01' }).expect(200);
      expect(res.body).toMatchObject({ etapa: 'EN_VERDE', fechaEntrega: '2027-12-01' });

      await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken)).send({ etapa: 'EN_OBRA' }).expect(400);
      await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken)).send({ fechaEntrega: '01-12-2027' }).expect(400);
      await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken)).send({ fechaEntrega: '2027-02-30' }).expect(400);
      const borrado = await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken)).send({ etapa: null, fechaEntrega: null }).expect(200);
      expect(borrado.body).toMatchObject({ etapa: null, fechaEntrega: null });
    });

    it('PATCH sala de ventas con ADMIN -> 200; coordenadas fuera de rango o teléfono largo -> 400', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID, ciudad: { id: 1 } });
      const sala = { salaDireccion: '1 Sur 100, Talca', salaHorario: 'Lun a sáb 10:00 a 18:00', salaTelefono: '+56712345678', salaLatitud: -35.42, salaLongitud: -71.66 };
      const res = await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken)).send(sala).expect(200);
      expect(res.body).toMatchObject(sala);
      expect(entornoMock.calcular).not.toHaveBeenCalled(); // la sala no cambia el entorno del proyecto

      await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken)).send({ salaLatitud: -95 }).expect(400);
      await http().patch(`/api/proyectos/${UUID}`).set(auth(adminToken)).send({ salaTelefono: '1'.repeat(21) }).expect(400);
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

    it('PATCH :id/publicar vuelve a publicar un despublicado; publicado o inexistente -> 404; SECRETARIO -> 403', async () => {
      repo(Proyecto).update.mockResolvedValue({ affected: 1 });
      await http().patch(`/api/proyectos/${UUID}/publicar`).set(auth(adminToken)).expect(200);
      expect(repo(Proyecto).update).toHaveBeenCalledWith({ id: UUID, activo: false }, { activo: true });

      repo(Proyecto).update.mockResolvedValue({ affected: 0 });
      await http().patch(`/api/proyectos/${UUID}/publicar`).set(auth(adminToken)).expect(404);
      await http().patch(`/api/proyectos/${UUID}/publicar`).set(auth(secretarioToken)).expect(403);
    });

    it('GET /admin lista también los despublicados; solo ADMIN', async () => {
      repo(Proyecto).find.mockResolvedValue([{ id: UUID, activo: false }]);
      const res = await http().get('/api/proyectos/admin').set(auth(adminToken)).expect(200);
      expect(res.body).toEqual([{ id: UUID, activo: false }]);
      expect(repo(Proyecto).find).toHaveBeenLastCalledWith({ order: { activo: 'DESC', nombre: 'ASC' } });
      await http().get('/api/proyectos/admin').expect(401);
      await http().get('/api/proyectos/admin').set(auth(secretarioToken)).expect(403);
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
      expect(guardado).toMatchObject({ tipoVivienda: 'CASA', gastosComunes: null, subsidios: [] });
      expect(guardado.estacionamientos).toBe(1);
      expect(guardado).not.toHaveProperty('campoExtra');

      await esperarAuditoria();
      expect(repo(Auditoria).save).toHaveBeenCalledWith(expect.objectContaining({
        accion: 'POST /api/modeloCasa', estado: 201, exito: true, idUsuario: 'admin-id', rol: 'ADMIN',
      }));
    });

    it('departamento sin terreno -> 201; casa sin terreno -> 400', async () => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID });
      const { superficieTerreno: _t, ...sinTerreno } = body;
      await http().post('/api/modeloCasa').set(auth(adminToken))
        .send({ ...sinTerreno, tipoVivienda: 'DEPARTAMENTO', gastosComunes: 85000, subsidios: ['DS1', 'DS19'], bono: 'Bono pie 10%', planoUrl: 'https://x/plano.png' })
        .expect(201);
      expect(repo(ModeloCasa).save.mock.calls[0][0]).toMatchObject({ tipoVivienda: 'DEPARTAMENTO', superficieTerreno: null, gastosComunes: 85000, subsidios: ['DS1', 'DS19'] });
      await http().post('/api/modeloCasa').set(auth(adminToken)).send(sinTerreno).expect(400);
    });

    it.each([
      ['tipo de vivienda desconocido', { tipoVivienda: 'BODEGA' }],
      ['gastos comunes negativos', { gastosComunes: -1 }],
      ['gastos comunes con decimales', { gastosComunes: 1.5 }],
      ['gastos comunes como boolean (formato antiguo)', { gastosComunes: true }],
      ['subsidio desconocido', { subsidios: ['DS49'] }],
      ['subsidio repetido', { subsidios: ['DS1', 'DS1'] }],
      ['bono de más de 150 caracteres', { bono: 'a'.repeat(151) }],
    ])('crear con %s -> 400', async (_caso, cambio) => {
      repo(Proyecto).findOne.mockResolvedValue({ id: UUID });
      await http().post('/api/modeloCasa').set(auth(adminToken)).send({ ...body, ...cambio }).expect(400);
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

    it('PATCH unidades y publicar: el estado lo calcula el servidor (el enviado se ignora)', async () => {
      repo(ModeloCasa).findOne.mockResolvedValue({
        id: UUID, nombreModelo: 'Casa A', activo: false, caracteristicas: [],
        unidades: 2, unidadesReservadas: 2, unidadesVendidas: 0, estado: 'RESERVADO',
      });
      const res = await http().patch(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).send({ estado: 'VENDIDO', unidades: 4, activo: true }).expect(200);
      expect(res.body).toMatchObject({ unidades: 4, estado: 'DISPONIBLE', activo: true });
      await http().patch(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).send({ unidades: 0 }).expect(400);
      await http().patch(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).send({ unidades: 1.5 }).expect(400);
      await http().patch(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).send({ unidades: 1 }).expect(400);
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

    it('POST /:id/duplicar crea un borrador con el nombre enviado (sin espacios al borde); inexistente -> 404; SECRETARIO -> 403', async () => {
      const url = `/api/modeloCasa/${UUID}/duplicar`;
      const original = { id: 'orig', nombreModelo: 'Casa A', activo: true, fotos: [], caracteristicas: [] };
      repo(ModeloCasa).findOne.mockResolvedValueOnce(original);
      const res = await http().post(url).set(auth(adminToken)).send({ nombreModelo: '  Casa B  ' }).expect(201);
      expect(res.body).toMatchObject({ id: UUID, nombreModelo: 'Casa B', activo: false });

      await http().post(url).set(auth(adminToken)).send({ nombreModelo: 'Casa B' }).expect(404);
      await http().post(url).set(auth(secretarioToken)).send({ nombreModelo: 'Casa B' }).expect(403);
      await http().post(url).send({ nombreModelo: 'Casa B' }).expect(401);
    });

    it('GET /admin/nombre-disponible responde antes que /admin/:id; valida nombre y excluirId; solo ADMIN', async () => {
      const url = '/api/modeloCasa/admin/nombre-disponible';
      repo(ModeloCasa).findOne.mockResolvedValueOnce(null);
      expect((await http().get(`${url}?nombre=${encodeURIComponent('  Casa Z ')}`).set(auth(adminToken)).expect(200)).body).toEqual({ disponible: true });
      expect(repo(ModeloCasa).findOne).toHaveBeenLastCalledWith({ where: { nombreModelo: 'Casa Z' } });

      repo(ModeloCasa).findOne.mockResolvedValueOnce({ id: 'otro' });
      expect((await http().get(`${url}?nombre=Casa%20A`).set(auth(adminToken)).expect(200)).body).toEqual({ disponible: false });

      repo(ModeloCasa).findOne.mockResolvedValueOnce({ id: UUID });
      expect((await http().get(`${url}?nombre=Casa%20A&excluirId=${UUID}`).set(auth(adminToken)).expect(200)).body).toEqual({ disponible: true });

      await http().get(url).set(auth(adminToken)).expect(400);
      await http().get(`${url}?nombre=%20%20`).set(auth(adminToken)).expect(400);
      await http().get(`${url}?nombre=${'a'.repeat(151)}`).set(auth(adminToken)).expect(400);
      await http().get(`${url}?nombre=Casa&excluirId=no-es-uuid`).set(auth(adminToken)).expect(400);
      await http().get(`${url}?nombre=Casa`).set(auth(secretarioToken)).expect(403);
      await http().get(`${url}?nombre=Casa`).expect(401);
    });

    it('POST /:id/duplicar con nombre en uso -> 409 y no guarda', async () => {
      repo(ModeloCasa).findOne
        .mockResolvedValueOnce({ id: 'orig', nombreModelo: 'Casa A', fotos: [], caracteristicas: [] })
        .mockResolvedValueOnce({ id: 'otro', nombreModelo: 'Casa A' });
      const res = await http().post(`/api/modeloCasa/${UUID}/duplicar`).set(auth(adminToken)).send({ nombreModelo: 'Casa A' }).expect(409);
      expect(res.body.message).toContain('Ya existe un modelo con el nombre "Casa A"');
      expect(repo(ModeloCasa).save).not.toHaveBeenCalled();
    });

    it.each([
      [{}],
      [{ nombreModelo: '' }],
      [{ nombreModelo: '   ' }],
      [{ nombreModelo: 'a'.repeat(151) }],
    ])('POST /:id/duplicar con nombre inválido %j -> 400', (body) =>
      http().post(`/api/modeloCasa/${UUID}/duplicar`).set(auth(adminToken)).send(body).expect(400));

    it('DELETE despublica (borrado lógico); inexistente -> 404; SECRETARIO -> 403', async () => {
      repo(ModeloCasa).update.mockResolvedValue({ affected: 1 });
      await http().delete(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).expect(200);
      expect(repo(ModeloCasa).update).toHaveBeenCalledWith({ id: UUID, activo: true }, { activo: false });
      expect(repo(ModeloCasa).delete).not.toHaveBeenCalled();

      repo(ModeloCasa).update.mockResolvedValue({ affected: 0 });
      await http().delete(`/api/modeloCasa/${UUID}`).set(auth(adminToken)).expect(404);
      await http().delete(`/api/modeloCasa/${UUID}`).set(auth(secretarioToken)).expect(403);
    });

    it('PUT /:id/fotos/orden reordena con ADMIN; ids inválidos -> 400; SECRETARIO -> 403', async () => {
      const url = `/api/modeloCasa/${UUID}/fotos/orden`;
      const F1 = '22222222-2222-4222-8222-222222222222', F2 = '33333333-3333-4333-8333-333333333333';
      repo(GaleriaModeloCasa).find.mockResolvedValue([
        { id: F1, urlImagen: 'https://x/1.jpg', orden: 0 },
        { id: F2, urlImagen: 'https://x/2.jpg', orden: 1 },
      ]);
      const res = await http().put(url).set(auth(adminToken)).send({ ids: [F2, F1] }).expect(200);
      expect(res.body.map((f: { id: string; orden: number }) => [f.id, f.orden])).toEqual([[F2, 0], [F1, 1]]);

      await http().put(url).set(auth(adminToken)).send({ ids: ['no-es-uuid'] }).expect(400);
      await http().put(url).set(auth(adminToken)).send({ ids: [F1, F1] }).expect(400);
      await http().put(url).set(auth(secretarioToken)).send({ ids: [F2, F1] }).expect(403);
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

    it('GET me: devuelve el propio perfil sin contraseña; sin token -> 401', async () => {
      repo(Usuario).findOne.mockImplementation(async ({ where }) => ({ ...usuarios[where?.id], nombre: 'Sec', contrasena: 'hash' }));
      const res = await http().get('/api/usuarios/me').set(auth(secretarioToken)).expect(200);
      expect(res.body).toMatchObject({ id: 'sec-id', correo: 'sec@x.cl', nombre: 'Sec' });
      expect(res.body).not.toHaveProperty('contrasena');
      await http().get('/api/usuarios/me').expect(401);
    });

    it('PATCH me: el SECRETARIO cambia su nombre y su foto; el correo no se puede cambiar', async () => {
      const foto = 'https://bucket-test.s3.us-east-1.amazonaws.com/perfiles/0f8fad5b-d9cb-469f-a165-70867728950e.png';
      const res = await http().patch('/api/usuarios/me').set(auth(secretarioToken))
        .send({ nombre: '  Secretaria Uno ', fotoUrl: foto, correo: 'otro@x.cl' }).expect(200);
      expect(res.body).toMatchObject({ id: 'sec-id', nombre: 'Secretaria Uno', fotoUrl: foto, correo: 'sec@x.cl' });
      expect(repo(Usuario).save).toHaveBeenCalledWith(expect.objectContaining({ id: 'sec-id', correo: 'sec@x.cl' }));
    });

    it('PATCH me: nombre vacío o foto externa -> 400', async () => {
      await http().patch('/api/usuarios/me').set(auth(secretarioToken)).send({ nombre: '   ' }).expect(400);
      await http().patch('/api/usuarios/me').set(auth(secretarioToken)).send({ nombre: null }).expect(400);
      await http().patch('/api/usuarios/me').set(auth(secretarioToken)).send({ fotoUrl: 'https://evil.com/x.png' }).expect(400);
      expect(repo(Usuario).save).not.toHaveBeenCalled();
    });

    it('PATCH me/contrasena: el SECRETARIO cambia la suya con la actual correcta', async () => {
      const hash = await bcrypt.hash('Actual12345', 4);
      repo(Usuario).findOne.mockImplementation(async ({ where }) => ({ ...usuarios[where?.id], contrasena: hash }));
      await http().patch('/api/usuarios/me/contrasena').set(auth(secretarioToken)).send({ actual: 'Mala1234567', nueva: 'Nueva123456' }).expect(400);
      await http().patch('/api/usuarios/me/contrasena').set(auth(secretarioToken)).send({ actual: 'Actual12345', nueva: 'debil' }).expect(400);
      await http().patch('/api/usuarios/me/contrasena').set(auth(secretarioToken)).send({ actual: 'Actual12345', nueva: 'Nueva123456' }).expect(200);
      expect(repo(Usuario).save).toHaveBeenCalledWith(expect.objectContaining({ id: 'sec-id' }));
    });

    it('PATCH me/contrasena devuelve un token nuevo y los tokens anteriores al cambio dejan de servir', async () => {
      const hash = await bcrypt.hash('Actual12345', 4);
      repo(Usuario).findOne.mockImplementation(async ({ where }) => ({ ...usuarios[where?.id], contrasena: hash }));
      const res = await http().patch('/api/usuarios/me/contrasena').set(auth(secretarioToken))
        .send({ actual: 'Actual12345', nueva: 'Nueva123456' }).expect(200);
      const cambiadaEn: Date = repo(Usuario).save.mock.calls.at(-1)![0].contrasenaCambiadaEn;
      expect(cambiadaEn).toBeInstanceOf(Date);

      // Desde ahora la BD devuelve la fecha del cambio
      repo(Usuario).findOne.mockImplementation(async ({ where }) => ({ ...usuarios[where?.id], contrasenaCambiadaEn: cambiadaEn }));
      const anterior = app.get(JwtService).sign({ sub: 'sec-id', correo: 'sec@x.cl', rol: 'SECRETARIO', iat: Math.floor(cambiadaEn.getTime() / 1000) - 60 });
      await http().get('/api/solicitudes').set(auth(anterior)).expect(401);
      await http().get('/api/solicitudes').set(auth(res.body.access_token)).expect(200);
    });
  });

  describe('métricas', () => {
    it('GET con ADMIN -> 200; SECRETARIO -> 403', async () => {
      const qb = { innerJoin: jest.fn(), select: jest.fn(), addSelect: jest.fn(), where: jest.fn(), groupBy: jest.fn(), addGroupBy: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), getRawMany: jest.fn().mockResolvedValue([]) };
      for (const m of ['innerJoin', 'select', 'addSelect', 'where', 'groupBy', 'addGroupBy', 'orderBy', 'limit'] as const) qb[m].mockReturnValue(qb);
      // Dos consultas agrupadas sobre solicitudes: por semana y más consultados
      repo(Solicitud).createQueryBuilder.mockReturnValueOnce(qb).mockReturnValueOnce(qb);
      const qbCasas = { select: jest.fn(), addSelect: jest.fn(), where: jest.fn(), getRawOne: jest.fn().mockResolvedValue({ unidades: '4', reservados: '1', vendidos: null }) };
      for (const m of ['select', 'addSelect', 'where'] as const) qbCasas[m].mockReturnValue(qbCasas);
      repo(ModeloCasa).createQueryBuilder.mockReturnValueOnce(qbCasas);
      const res = await http().get('/api/metricas').set(auth(adminToken)).expect(200);
      expect(res.body).toMatchObject({
        solicitudes: { pendientes: 0 }, modelos: { publicados: 0, unidades: 4, disponibles: 3, reservados: 1, vendidos: 0 }, masSolicitados: [],
        reservas: { reservasMes: 0, ventasMes: 0 }, visitas: { proximos7Dias: 0, proximas: [] },
      });
      expect(res.body.solicitudes.porSemana).toHaveLength(8);
      // Muestra nombres de visitas: queda auditado como lectura de datos personales
      await esperarAuditoria();
      expect(repo(Auditoria).create).toHaveBeenCalledWith(expect.objectContaining({ accion: 'GET /api/metricas', idUsuario: 'admin-id' }));
      await http().get('/api/metricas').set(auth(secretarioToken)).expect(403);
    });

    it('POST /api/metricas/eventos: público, valida el cuerpo y responde 404 si el modelo no está publicado', async () => {
      repo(ModeloCasa).exists.mockResolvedValueOnce(true);
      await http().post('/api/metricas/eventos').send({ id_modelo_casa: UUID, tipo: 'AR_INICIADA' }).expect(204);
      expect(repo(EventoModelo).save).toHaveBeenCalledWith({ tipo: 'AR_INICIADA', modeloCasa: { id: UUID } });

      await http().post('/api/metricas/eventos').send({ id_modelo_casa: UUID, tipo: 'OTRO' }).expect(400);
      await http().post('/api/metricas/eventos').send({ id_modelo_casa: 'no-uuid', tipo: 'QR_ESCANEADO' }).expect(400);
      repo(ModeloCasa).exists.mockResolvedValueOnce(false);
      await http().post('/api/metricas/eventos').send({ id_modelo_casa: UUID, tipo: 'QR_ESCANEADO' }).expect(404);
    });
  });

  describe('panel de seguimiento (secretaria)', () => {
    it('GET /api/metricas/seguimiento: SECRETARIO y ADMIN; auditado como lectura de datos personales', async () => {
      repo(Auditoria).create.mockClear();
      const res = await http().get('/api/metricas/seguimiento').set(auth(secretarioToken)).expect(200);
      expect(res.body).toMatchObject({
        solicitudes: { pendientes: 0, porContactar: [] }, visitas: { proximos7Dias: 0, proximas: [] }, reservas: { enCurso: 0, porCerrar: [] },
      });
      await esperarAuditoria();
      expect(repo(Auditoria).create).toHaveBeenCalledWith(expect.objectContaining({ accion: 'GET /api/metricas/seguimiento', idUsuario: 'sec-id' }));
      await http().get('/api/metricas/seguimiento').set(auth(adminToken)).expect(200);
      await http().get('/api/metricas/seguimiento').expect(401);
    });
  });

  describe('resumen de solicitudes (contador del menú)', () => {
    it('GET /api/solicitudes/resumen: solo el número, para SECRETARIO y ADMIN, sin auditar', async () => {
      repo(Solicitud).count.mockResolvedValue(7);
      repo(Auditoria).create.mockClear();
      const res = await http().get('/api/solicitudes/resumen').set(auth(secretarioToken)).expect(200);
      expect(res.body).toEqual({ pendientes: 7 });
      await http().get('/api/solicitudes/resumen').set(auth(adminToken)).expect(200);
      await esperarAuditoria();
      expect(repo(Auditoria).create).not.toHaveBeenCalled();
      await http().get('/api/solicitudes/resumen').expect(401);
    });
  });

  describe('reservas', () => {
    const crear = { id_solicitud: UUID, rut: '12.345.678-5' };

    it('POST sin token -> 401', () =>
      http().post('/api/reservas').send(crear).expect(401));

    it.each([
      ['RUT con dígito verificador incorrecto', { rut: '12.345.678-4' }],
      ['RUT vacío', { rut: '' }],
      ['id_solicitud que no es UUID', { id_solicitud: 'x' }],
      ['lote de más de 50 caracteres', { lote: 'x'.repeat(51) }],
    ])('POST con %s -> 400', (_caso, cambio) =>
      http().post('/api/reservas').set(auth(secretarioToken)).send({ ...crear, ...cambio }).expect(400));

    it('POST con RUT inválido explica el motivo', async () => {
      const res = await http().post('/api/reservas').set(auth(secretarioToken)).send({ ...crear, rut: '1-1' }).expect(400);
      expect(res.body.message).toContain('RUT inválido');
    });

    it.each(['RESERVADA', 'PAGADA', undefined])('PATCH estado %p -> 400', (estado) =>
      http().patch(`/api/reservas/${UUID}/estado`).set(auth(adminToken)).send({ estado }).expect(400));

    it('PATCH con id que no es UUID -> 400; sin token -> 401', async () => {
      await http().patch('/api/reservas/x/estado').set(auth(adminToken)).send({ estado: 'VENDIDA' }).expect(400);
      await http().patch(`/api/reservas/${UUID}/estado`).send({ estado: 'VENDIDA' }).expect(401);
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

    it('POST con visita: 201 si el proyecto tiene sala; formato inválido -> 400; sin sala -> 400', async () => {
      const visita = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      repo(ModeloCasa).findOne.mockResolvedValue({ id: UUID, proyecto: { salaDireccion: '1 Sur 100' } });
      const res = await http().post('/api/solicitudes').send({ ...body, visitaPreferida: visita }).expect(201);
      expect(new Date(res.body.visitaPreferida).toISOString()).toBe(visita);

      await http().post('/api/solicitudes').send({ ...body, visitaPreferida: 'mañana a las 5' }).expect(400);
      repo(ModeloCasa).findOne.mockResolvedValue({ id: UUID, proyecto: { salaDireccion: null } });
      await http().post('/api/solicitudes').send({ ...body, visitaPreferida: visita }).expect(400);
    });

    it.each([
      ['sin aceptar la política', { aceptaPrivacidad: undefined }],
      ['rechazando la política', { aceptaPrivacidad: false }],
      ['con correo inválido', { correo: 'x' }],
      ['con celular corto', { celular: '1234' }],
      ['con celular fijo', { celular: '+56 2 2345 6789' }],
      ['con celular extranjero', { celular: '+54 9 11 2345 6789' }],
    ])('POST %s -> 400', async (_caso, cambio) => {
      repo(ModeloCasa).findOne.mockResolvedValue({ id: UUID });
      await http().post('/api/solicitudes').send({ ...body, ...cambio }).expect(400);
    });

    it.each(['9 1234 5678', '912345678', '+56 9 1234-5678', '56912345678'])(
      'POST con celular "%s" se guarda como +56912345678', async (celular) => {
        repo(ModeloCasa).findOne.mockResolvedValue({ id: UUID });
        const res = await http().post('/api/solicitudes').send({ ...body, celular }).expect(201);
        expect(res.body.celular).toBe('+56912345678');
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

    it('GET /exportar descarga CSV para SECRETARIO y queda auditado; sin token -> 401', async () => {
      const res = await http().get('/api/solicitudes/exportar').set(auth(secretarioToken)).expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('solicitudes.csv');
      expect(res.text).toContain('Fecha;Nombre;Apellido');
      await esperarAuditoria();
      expect(repo(Auditoria).create).toHaveBeenCalledWith(expect.objectContaining({ accion: 'EXPORTAR_SOLICITUDES', idUsuario: 'sec-id' }));

      await http().get('/api/solicitudes/exportar').expect(401);
    });

    it('GET con SECRETARIO -> 200', () =>
      http().get('/api/solicitudes').set(auth(secretarioToken)).expect(200));

    it('GET con ADMIN -> 200', () =>
      http().get('/api/solicitudes').set(auth(adminToken)).expect(200));

    it('GET paginado: valores por defecto, query convertida a números y validada', async () => {
      repo(Solicitud).findAndCount.mockResolvedValue([[{ id: UUID }], 41]);
      repo(Solicitud).count.mockResolvedValue(3);
      const res = await http().get('/api/solicitudes').set(auth(secretarioToken)).expect(200);
      expect(res.body).toEqual({ solicitudes: [{ id: UUID }], total: 41, pendientes: 3, pagina: 1, limite: 20 });

      await http().get('/api/solicitudes?pagina=3&limite=10&filtro=contactados').set(auth(secretarioToken)).expect(200);
      expect(repo(Solicitud).findAndCount).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 20, take: 10, where: { contactado: true } }));

      for (const q of ['pagina=0', 'pagina=x', 'limite=101', 'filtro=borradas']) {
        await http().get(`/api/solicitudes?${q}`).set(auth(secretarioToken)).expect(400);
      }
    });

    it('GET /:id (cotización) con su modelo para SECRETARIO y ADMIN; 401, 404 y 400', async () => {
      repo(Solicitud).findOne.mockResolvedValue({ id: UUID, nombre: 'Ana', modeloCasa: { id: 'm1', nombreModelo: 'Aurora' } });
      const res = await http().get(`/api/solicitudes/${UUID}`).set(auth(secretarioToken)).expect(200);
      expect(res.body.modeloCasa.nombreModelo).toBe('Aurora');
      expect(repo(Solicitud).findOne).toHaveBeenCalledWith({ where: { id: UUID }, relations: { modeloCasa: { proyecto: { ciudad: { region: true } } }, reservas: true } });
      await http().get(`/api/solicitudes/${UUID}`).set(auth(adminToken)).expect(200);

      await http().get(`/api/solicitudes/${UUID}`).expect(401);
      await http().get('/api/solicitudes/123').set(auth(secretarioToken)).expect(400);
      repo(Solicitud).findOne.mockResolvedValue(null);
      await http().get(`/api/solicitudes/${UUID}`).set(auth(secretarioToken)).expect(404);
    });

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

      it('con reserva activa o venta -> 409 con el motivo, por id y por correo', async () => {
        repo(Reserva).exists.mockResolvedValue(true);
        const res = await http().delete(`/api/solicitudes/${UUID}`).set(auth(adminToken)).expect(409);
        expect(res.body.message).toContain('se conservan para ejecutar el contrato');
        await http().delete('/api/solicitudes?correo=j@p.cl').set(auth(adminToken)).expect(409);
        repo(Reserva).exists.mockResolvedValue(false);
      });

      it('SECRETARIO no puede borrar -> 403', () =>
        http().delete(`/api/solicitudes/${UUID}`).set(auth(secretarioToken)).expect(403));
    });
  });

  describe('auditoría', () => {
    it('GET /api/auditoria solo para ADMIN, paginado y con descripción', async () => {
      repo(Auditoria).findAndCount.mockResolvedValue([[{ id: 'a1', accion: 'POST /api/auth/login', metodo: 'POST', ruta: '/api/auth/login', estado: 401, exito: false }], 1]);
      const res = await http().get('/api/auditoria?pagina=2&limite=100').set(auth(adminToken)).expect(200);
      expect(res.body).toEqual({ registros: [expect.objectContaining({ id: 'a1', descripcion: 'Inicio de sesión fallido' })], total: 1, pagina: 2, limite: 100 });
      expect(repo(Auditoria).findAndCount).toHaveBeenCalledWith({ where: {}, order: { secuencia: 'DESC' }, skip: 100, take: 100 });

      await http().get('/api/auditoria').set(auth(secretarioToken)).expect(403);
      await http().get('/api/auditoria').expect(401);
    });

    it('GET /api/auditoria con filtros: convierte la query y valida', async () => {
      await http().get('/api/auditoria?modulo=proyectos&soloRechazados=true&correo=%20ana%20').set(auth(adminToken)).expect(200);
      const { where } = repo(Auditoria).findAndCount.mock.calls.at(-1)![0];
      expect(where).toEqual([expect.objectContaining({ exito: false, ruta: expect.objectContaining({ _type: 'like', _value: '/api/proyectos%' }) })]);
      expect(where[0].correo).toMatchObject({ _type: 'ilike', _value: '%ana%' });

      for (const q of ['limite=500', 'pagina=0', 'modulo=otro', 'soloRechazados=quizas', 'desde=ayer', `correo=${'x'.repeat(101)}`]) {
        await http().get(`/api/auditoria?${q}`).set(auth(adminToken)).expect(400);
      }
    });

    it('GET /api/auditoria/verificar: resultado de la cadena; solo ADMIN', async () => {
      fakeDataSource.query.mockResolvedValueOnce([{ secuencia: '3', problema: 'enlace_roto' }]).mockResolvedValueOnce([{ total: 9, secuencia: '9', hash: 'f'.repeat(64) }]);
      const res = await http().get('/api/auditoria/verificar').set(auth(adminToken)).expect(200);
      expect(res.body).toMatchObject({ integra: false, total: 9, ultimo: { secuencia: '9' }, problemas: [{ secuencia: '3', problema: 'enlace_roto' }] });

      await http().get('/api/auditoria/verificar').set(auth(secretarioToken)).expect(403);
    });

    it('si falla guardar la auditoría, la petición igual responde', async () => {
      repo(Auditoria).save.mockRejectedValueOnce(new Error('BD caída'));
      repo(ModeloCasa).findOne.mockResolvedValue({ id: UUID });
      await http().post('/api/solicitudes').send({
        nombre: 'A', apellido: 'B', correo: 'a@b.cl', celular: '+56911111111', id_modelo_casa: UUID, aceptaPrivacidad: true,
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

    it('SECRETARIO: puede subir a perfiles (201) pero no a otras carpetas (403)', async () => {
      const res = await http().post('/api/s3/presigned-url').set(auth(secretarioToken))
        .send({ ...archivo, carpeta: 'perfiles' }).expect(201);
      expect(res.body.key).toMatch(/^perfiles\/.+\.jpg$/);
      await http().post('/api/s3/presigned-url').set(auth(secretarioToken)).send(archivo).expect(403);
    });

    it('presigned-url con ADMIN -> 201 con uploadUrl firmado', async () => {
      const res = await http().post('/api/s3/presigned-url').set(auth(adminToken)).send(archivo).expect(201);
      expect(res.body.key).toMatch(/^proyectos\/.+\.jpg$/);
      expect(res.body.uploadUrl).toContain('X-Amz-Signature=');
      expect(res.body.contentType).toBe('image/jpeg');
    });
  });
});
