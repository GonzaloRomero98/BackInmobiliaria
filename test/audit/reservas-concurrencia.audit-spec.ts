// Auditoría RF-11 / RF-14 contra PostgreSQL REAL (no mocks): concurrencia de reservas, estados finales
// y retención. Requiere una BD desechable (AUDIT_DB_*); se ejecuta con test/audit/jest-audit.json.
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { migraciones } from '../../src/migrations';
import { Usuario } from '../../src/modules/usuario/entities/usuario.entity';
import { Rol } from '../../src/modules/rol/entities/rol.entity';
import { Proyecto } from '../../src/modules/proyecto/entities/proyecto.entity';
import { NormativaProyecto } from '../../src/modules/proyecto/entities/normativaProyecto.entity';
import { Ciudad } from '../../src/modules/ubicacion/entities/ciudad.entity';
import { Region } from '../../src/modules/ubicacion/entities/region.entity';
import { ModeloCasa } from '../../src/modules/modeloCasa/entities/modeloCasa.entity';
import { GaleriaModeloCasa } from '../../src/modules/modeloCasa/entities/galeriaModeloCasa.entity';
import { Caracteristica } from '../../src/modules/caracteristicas/entities/caracteristica.entity';
import { Solicitud } from '../../src/modules/solicitud/entities/solicitud.entity';
import { Reserva } from '../../src/modules/reserva/entities/reserva.entity';
import { Auditoria } from '../../src/modules/auditoria/entities/auditoria.entity';
import { ReservaService } from '../../src/modules/reserva/reserva.service';
import { SolicitudService } from '../../src/modules/solicitud/solicitud.service';
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service';
import { EstadoReserva } from '../../src/modules/reserva/reserva.enum';

const env = process.env;
let ds: DataSource;
let reservas: ReservaService;
let solicitudes: SolicitudService;
let modelos: Repository<ModeloCasa>;
let proyecto: Proyecto;
let n = 0;

async function crearModelo(unidades: number): Promise<ModeloCasa> {
  return modelos.save(modelos.create({
    nombreModelo: `Audit ${++n}`, tipoOperacion: 'VENTA', dormitorios: 3, banos: 2,
    superficieConstruida: 80, superficieTerreno: 150, precio: 3000, moneda: 'UF',
    imgPrincipal: 'https://ejemplo/img.png', unidades, proyecto,
  }));
}

async function crearSolicitud(modelo: ModeloCasa, correo = `p${++n}@audit.cl`, creadoEn?: Date): Promise<Solicitud> {
  const s = await ds.getRepository(Solicitud).save({
    nombre: 'Ana', apellido: 'Pérez', correo, celular: '+56912345678', modeloCasa: modelo, consentimientoEn: new Date(),
  });
  if (creadoEn) await ds.query(`UPDATE solicitud SET creado_en = $1 WHERE id = $2`, [creadoEn, s.id]);
  return s;
}

const recargar = (id: string) => modelos.findOneByOrFail({ id });

beforeAll(async () => {
  ds = new DataSource({
    type: 'postgres', host: env.AUDIT_DB_HOST ?? 'localhost', port: Number(env.AUDIT_DB_PORT ?? 5434),
    username: env.AUDIT_DB_USER ?? 'postgres', password: env.AUDIT_DB_PASSWORD ?? 'auditoria',
    database: env.AUDIT_DB_NAME ?? 'auditoria',
    entities: [Usuario, Rol, Proyecto, NormativaProyecto, Ciudad, Region, ModeloCasa, GaleriaModeloCasa,
      Caracteristica, Solicitud, Reserva, Auditoria],
    migrations: migraciones, dropSchema: true, extra: { max: 20 },
  });
  await ds.initialize();
  await ds.runMigrations();

  const region = await ds.getRepository(Region).save({ nombre: 'Maule' });
  const ciudad = await ds.getRepository(Ciudad).save({ nombre: 'Curicó', region });
  proyecto = await ds.getRepository(Proyecto).save({ nombre: 'Proyecto auditoría', descripcion: 'x', ciudad });
  modelos = ds.getRepository(ModeloCasa);

  reservas = new ReservaService(ds);
  const auditoria = new AuditoriaService(ds.getRepository(Auditoria), ds.getRepository(Proyecto),
    ds.getRepository(ModeloCasa), ds.getRepository(Usuario), ds);
  solicitudes = new SolicitudService(ds.getRepository(Solicitud), modelos,
    new ConfigService({ SOLICITUD_RETENCION_DIAS: '365' }), auditoria, ds.getRepository(Reserva));
}, 120_000);

afterAll(async () => { await ds?.destroy(); });

describe('RF-11 Reservas (PostgreSQL real)', () => {
  it('10 reservas simultáneas de solicitudes distintas sobre la ÚLTIMA unidad: solo 1 tiene éxito', async () => {
    const modelo = await crearModelo(1);
    const sols = await Promise.all(Array.from({ length: 10 }, () => crearSolicitud(modelo)));
    const resultados = await Promise.allSettled(sols.map((s) => reservas.crear({ id_solicitud: s.id, rut: '12345678-5' })));

    const ok = resultados.filter((r) => r.status === 'fulfilled');
    const rechazos = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(rechazos).toHaveLength(9);
    rechazos.forEach((r) => expect(r.reason).toBeInstanceOf(ConflictException));
    const m = await recargar(modelo.id);
    expect(m.unidadesReservadas).toBe(1);
    expect(m.estado).toBe('RESERVADO');
    expect(await ds.getRepository(Reserva).count({ where: { solicitud: { modeloCasa: { id: modelo.id } } } })).toBe(1);
  });

  it('5 reservas simultáneas de la MISMA solicitud: solo 1 activa (409 al resto)', async () => {
    const modelo = await crearModelo(5);
    const s = await crearSolicitud(modelo);
    const resultados = await Promise.allSettled(Array.from({ length: 5 }, () => reservas.crear({ id_solicitud: s.id, rut: '12345678-5' })));
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await recargar(modelo.id)).unidadesReservadas).toBe(1);
  });

  it('VENDIDA y ANULADA son estados finales; cambios simultáneos aplican solo uno', async () => {
    const modelo = await crearModelo(2);
    const r1 = await reservas.crear({ id_solicitud: (await crearSolicitud(modelo)).id, rut: '12345678-5' });
    const r2 = await reservas.crear({ id_solicitud: (await crearSolicitud(modelo)).id, rut: '12345678-5' });

    const carrera = await Promise.allSettled([
      reservas.cambiarEstado(r1.id, EstadoReserva.VENDIDA),
      reservas.cambiarEstado(r1.id, EstadoReserva.ANULADA),
      reservas.cambiarEstado(r1.id, EstadoReserva.VENDIDA),
    ]);
    expect(carrera.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    await reservas.cambiarEstado(r2.id, EstadoReserva.ANULADA);
    await expect(reservas.cambiarEstado(r2.id, EstadoReserva.VENDIDA)).rejects.toBeInstanceOf(BadRequestException);

    const m = await recargar(modelo.id);
    expect(m.unidadesReservadas).toBe(0);
    expect(m.unidadesReservadas + m.unidadesVendidas).toBeLessThanOrEqual(1);
  });

  it('anular libera la unidad y la misma solicitud puede volver a reservar', async () => {
    const modelo = await crearModelo(1);
    const s = await crearSolicitud(modelo);
    const r = await reservas.crear({ id_solicitud: s.id, rut: '12345678-5' });
    await reservas.cambiarEstado(r.id, EstadoReserva.ANULADA);
    expect((await recargar(modelo.id)).estado).toBe('DISPONIBLE');
    await expect(reservas.crear({ id_solicitud: s.id, rut: '12345678-5' })).resolves.toBeDefined();
  });
});

describe('Borrado diario de la auditoría (PostgreSQL real)', () => {
  it('vacía la tabla, la cadena reinicia íntegra y el bloqueo de DELETE/TRUNCATE sigue activo después', async () => {
    const auditoria = new AuditoriaService(ds.getRepository(Auditoria), ds.getRepository(Proyecto),
      ds.getRepository(ModeloCasa), ds.getRepository(Usuario), ds);
    for (let i = 0; i < 3; i++) await auditoria.registrar({ accion: `PRUEBA_${i}`, exito: true });
    process.env.AUDITORIA_BORRADO_DIARIO = 'true';
    try {
      expect(await auditoria.borradoDiario()).toBeGreaterThanOrEqual(3);
    } finally {
      delete process.env.AUDITORIA_BORRADO_DIARIO;
    }
    const filas = await ds.getRepository(Auditoria).find();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ accion: 'BORRADO_DIARIO_AUDITORIA', secuencia: '1' });
    expect((await auditoria.verificar()).integra).toBe(true);
    await expect(ds.query('DELETE FROM auditoria')).rejects.toThrow('solo inserción');
    await expect(ds.query('TRUNCATE auditoria')).rejects.toThrow('solo inserción');
  });
});

describe('RF-14 Privacidad y retención (PostgreSQL real)', () => {
  it('supresión por correo sin distinguir mayúsculas; 409 con reserva activa; vuelve a ser eliminable al anular', async () => {
    const modelo = await crearModelo(3);
    await crearSolicitud(modelo, 'Titular@Audit.cl');
    const conReserva = await crearSolicitud(modelo, 'titular@audit.cl');
    const r = await reservas.crear({ id_solicitud: conReserva.id, rut: '12345678-5' });

    await expect(solicitudes.eliminarPorCorreo('TITULAR@AUDIT.CL')).rejects.toBeInstanceOf(ConflictException);
    expect(await ds.getRepository(Solicitud).count({ where: { modeloCasa: { id: modelo.id } } })).toBe(2);

    await reservas.cambiarEstado(r.id, EstadoReserva.ANULADA);
    await expect(solicitudes.eliminarPorCorreo('TITULAR@AUDIT.CL')).resolves.toEqual({ eliminadas: 2 });
  });

  it('retención: borra > 365 días, conserva las recientes y las que tienen reserva activa o venta; queda auditado', async () => {
    const modelo = await crearModelo(5);
    const viejo = new Date(Date.now() - 400 * 24 * 3600 * 1000);
    const vieja = await crearSolicitud(modelo, undefined, viejo);
    const viejaReservada = await crearSolicitud(modelo, undefined, viejo);
    const viejaVendida = await crearSolicitud(modelo, undefined, viejo);
    const reciente = await crearSolicitud(modelo);
    await reservas.crear({ id_solicitud: viejaReservada.id, rut: '12345678-5' });
    const rv = await reservas.crear({ id_solicitud: viejaVendida.id, rut: '12345678-5' });
    await reservas.cambiarEstado(rv.id, EstadoReserva.VENDIDA);

    await solicitudes.eliminarVencidas();
    const quedan = (await ds.getRepository(Solicitud).find({ where: { modeloCasa: { id: modelo.id } } })).map((s) => s.id);
    expect(quedan).not.toContain(vieja.id);
    expect(quedan).toEqual(expect.arrayContaining([viejaReservada.id, viejaVendida.id, reciente.id]));
    expect(await ds.getRepository(Auditoria).count({ where: { accion: 'RETENCION_SOLICITUDES' } })).toBeGreaterThan(0);
  });
});
