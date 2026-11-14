import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { And, DataSource, FindOperator, FindOptionsWhere, ILike, In, LessThan, Like, MoreThanOrEqual, Repository } from "typeorm";
import { Auditoria } from "./entities/auditoria.entity";
import { Proyecto } from "../proyecto/entities/proyecto.entity";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { Usuario } from "../usuario/entities/usuario.entity";
import { analizarRuta, describirAccion, RECURSOS_CON_NOMBRE, RecursoConNombre } from "./auditoria.descripcion";
import { ListarAuditoriaDto, MODULOS_AUDITORIA } from "./dto/listarAuditoria.dto";

export type RegistroAuditoria = Partial<Omit<Auditoria, 'id' | 'fecha' | 'secuencia' | 'hashAnterior' | 'hash'>> & Pick<Auditoria, 'accion' | 'exito'>;

export type ProblemaCadena = 'sin_encadenar' | 'alterado' | 'faltan_anteriores' | 'enlace_roto';

// Para que %, _ y \ se busquen como texto y no como comodines de LIKE.
export const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, '\\$&');

// Recalcula el hash de cada registro con la misma función del trigger y devuelve solo los que tienen problemas.
const SQL_VERIFICAR = `
    SELECT secuencia::text AS secuencia, problema FROM (
        SELECT a.secuencia, CASE
            WHEN a.secuencia IS NULL OR a.hash IS NULL THEN 'sin_encadenar'
            WHEN a.hash <> auditoria_hash(a) THEN 'alterado'
            -- El registro más antiguo que queda es el inicio de la cadena: los anteriores los borró la retención
            -- (el trigger solo deja borrar registros de más de 2 años; ver purgarVencidos)
            WHEN lag(a.secuencia) OVER w IS NULL THEN NULL
            WHEN a.secuencia <> coalesce(lag(a.secuencia) OVER w, 0) + 1 THEN 'faltan_anteriores'
            WHEN a.hash_anterior IS DISTINCT FROM lag(a.hash) OVER w THEN 'enlace_roto'
        END AS problema
        FROM auditoria a
        WINDOW w AS (ORDER BY a.secuencia)
    ) x
    WHERE problema IS NOT NULL
    ORDER BY x.secuencia NULLS FIRST
    LIMIT 20`;

// Borra solo el comienzo de la cadena, para que nunca quede un hueco al medio.
// El ORDER BY usa la columna calificada (a./x.) porque sin calificar Postgres ordena por el alias de texto ('99' > '113').
const SQL_PURGAR = `
    WITH borrados AS (
        DELETE FROM auditoria
        WHERE fecha < auditoria_retencion_limite()
          AND secuencia < coalesce((SELECT min(secuencia) FROM auditoria WHERE fecha >= auditoria_retencion_limite()), 9223372036854775807)
        RETURNING secuencia, hash
    )
    SELECT count(*)::int AS eliminados,
        (SELECT b.secuencia::text FROM borrados b ORDER BY b.secuencia DESC LIMIT 1) AS "hastaSecuencia",
        (SELECT b.hash FROM borrados b ORDER BY b.secuencia DESC LIMIT 1) AS "hashCorte"
    FROM borrados`;

const SQL_ULTIMO =`SELECT (SELECT count(*) FROM auditoria)::int AS total, a.secuencia::text AS secuencia, a.hash FROM auditoria a ORDER BY a.secuencia DESC LIMIT 1`;

@Injectable()
export class AuditoriaService{
    private readonly logger = new Logger('Auditoria');

    constructor(
        @InjectRepository(Auditoria)
        private readonly auditoriaRepository: Repository<Auditoria>,
        @InjectRepository(Proyecto)
        private readonly proyectoRepository: Repository<Proyecto>,
        @InjectRepository(ModeloCasa)
        private readonly modeloCasaRepository: Repository<ModeloCasa>,
        @InjectRepository(Usuario)
        private readonly usuarioRepository: Repository<Usuario>,
        private readonly dataSource: DataSource,
    ){}

    // Nunca lanza error: un fallo al auditar no debe botar la petición, pero queda en el log.
    async registrar(registro: RegistroAuditoria): Promise<void>{
        this.logger.log(`${registro.accion} exito=${registro.exito} usuario=${registro.correo ?? '-'} ip=${registro.ip ?? '-'}`);
        try{
            await this.auditoriaRepository.save(this.auditoriaRepository.create(registro));
        }catch(error){
            this.logger.error(`No se pudo guardar el registro de auditoría: ${(error as Error).message}`);
        }
    }

    async listar(filtros: ListarAuditoriaDto){
        const {pagina, limite} = filtros;
        const [registros, total] = await this.auditoriaRepository.findAndCount({
            where: this.condiciones(filtros),
            order:{secuencia:'DESC'},
            skip:(pagina - 1) * limite,
            take:limite,
        });
        const nombres = await this.nombresDe(registros);
        return {
            registros: registros.map((r) => ({...r, descripcion: describirAccion(r, nombres)})),
            total, pagina, limite,
        };
    }

    private condiciones({correo, soloRechazados, desde, hasta, modulo}: ListarAuditoriaDto): FindOptionsWhere<Auditoria> | FindOptionsWhere<Auditoria>[]{
        const base: FindOptionsWhere<Auditoria> = {};
        if(correo) base.correo = ILike(`%${escaparLike(correo)}%`);
        if(soloRechazados) base.exito = false;
        const rango: FindOperator<Date>[] = [];
        if(desde) rango.push(MoreThanOrEqual(new Date(desde)));
        if(hasta) rango.push(LessThan(new Date(hasta)));
        if(rango.length) base.fecha = rango.length === 1 ? rango[0] : And(...rango);
        if(!modulo) return base;

        const {rutas, acciones} = MODULOS_AUDITORIA[modulo];
        return [
            ...rutas.map((ruta) => ({...base, ruta: Like(`${escaparLike(ruta)}%`)})),
            ...(acciones.length ? [{...base, accion: In([...acciones])}] : []),
        ];
    }

    private async nombresDe(registros: Auditoria[]): Promise<Map<string, string>>{
        const ids: Record<RecursoConNombre, Set<string>> = {proyectos: new Set(), modeloCasa: new Set(), usuarios: new Set()};
        for(const r of registros){
            const ruta = analizarRuta(r.ruta);
            if(ruta?.id && (RECURSOS_CON_NOMBRE as readonly string[]).includes(ruta.recurso)) ids[ruta.recurso as RecursoConNombre].add(ruta.id);
        }
        const buscar = async <T extends {id:string}>(repo: Repository<T>, set: Set<string>, campo: keyof T & string, nombre: (e: T) => string) =>
            set.size === 0 ? [] : (await repo.find({
                where: {id: In([...set])} as FindOptionsWhere<T>,
                select: {id: true, [campo]: true} as never,
                loadEagerRelations: false,
            })).map((e): [string, string] => [e.id, nombre(e)]);

        return new Map([
            ...await buscar(this.proyectoRepository, ids.proyectos, 'nombre', (p) => p.nombre),
            ...await buscar(this.modeloCasaRepository, ids.modeloCasa, 'nombreModelo', (m) => m.nombreModelo),
            ...await buscar(this.usuarioRepository, ids.usuarios, 'nombre', (u) => u.nombre),
        ]);
    }

    async verificar(){
        const [problemas, ultimos] = await Promise.all([
            this.dataSource.query(SQL_VERIFICAR) as Promise<{secuencia:string | null, problema:ProblemaCadena}[]>,
            this.dataSource.query(SQL_ULTIMO) as Promise<{total:number, secuencia:string, hash:string}[]>,
        ]);
        const ultimo = ultimos[0];
        return {
            integra: problemas.length === 0,
            total: ultimo?.total ?? 0,
            ultimo: ultimo ? {secuencia: ultimo.secuencia, hash: ultimo.hash} : null,
            problemas,
            verificadoEn: new Date().toISOString(),
        };
    }

    // Borra los registros con más de 2 años. El plazo está fijo en la BD y el trigger impide borrar registros más nuevos.
    @Cron('30 3 * * *', {timeZone:'America/Santiago'})
    async purgarVencidos(): Promise<number>{
        try{
            const [corte] = await this.dataSource.query(SQL_PURGAR) as {eliminados:number, hastaSecuencia:string | null, hashCorte:string | null}[];
            if(corte.eliminados > 0) await this.registrar({accion:'RETENCION_AUDITORIA', exito:true, detalle:{...corte}});
            return corte.eliminados;
        }catch(error){
            this.logger.error(`No se pudo aplicar la retención de la auditoría: ${(error as Error).message}`);
            return 0;
        }
    }

    // Cada día deja el último hash en el log del servidor.
    // Si alguien reescribe toda la cadena desde la BD, ese hash ya no coincide.
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async anclar(): Promise<void>{
        try{
            const [ultimo] = await this.dataSource.query(SQL_ULTIMO) as {secuencia:string, hash:string}[];
            this.logger.log(ultimo ? `ANCLA auditoria secuencia=${ultimo.secuencia} hash=${ultimo.hash}` : 'ANCLA auditoria vacía');
        }catch(error){
            this.logger.error(`No se pudo anclar la auditoría: ${(error as Error).message}`);
        }
    }
}
