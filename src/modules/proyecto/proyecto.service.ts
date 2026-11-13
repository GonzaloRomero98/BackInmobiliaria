import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Proyecto } from "./entities/proyecto.entity";
import { In, IsNull, Not, Repository } from "typeorm";
import { ModeloCasa } from "../modeloCasa/entities/modeloCasa.entity";
import { Solicitud } from "../solicitud/entities/solicitud.entity";
import { Ciudad } from "../ubicacion/entities/ciudad.entity";
import { CrearProyectoDto } from "./dto/crearProyecto.dto";
import { ActualizarProyectoDto } from "./dto/actualizarProyecto.dto";
import { NormativaProyecto } from "./entities/normativaProyecto.entity";
import { NormativaDto } from "./dto/normativa.dto";
import { distanciaMetros, Entorno, EntornoService } from "./entorno.service";

// Otro proyecto a menos de esto casi siempre es un duplicado o un clic equivocado en el mapa
export const DISTANCIA_DUPLICADO_M = 50;

@Injectable()
export class ProyectoService{
    private readonly logger = new Logger('Proyectos');

    constructor(
        @InjectRepository(Proyecto)
        private readonly proyectoRepository: Repository<Proyecto>,
        @InjectRepository(Ciudad)
        private readonly ciudadRepository:Repository<Ciudad>,
        @InjectRepository(NormativaProyecto)
        private readonly normativaRepository:Repository<NormativaProyecto>,
        private readonly entornoService: EntornoService
    ){}

    async crearProyecto(crearPoroyectoDto: CrearProyectoDto): Promise<Proyecto>{
        const ciudad = await this.buscarCiudad(crearPoroyectoDto.id_ciudad);
        await this.exigirConfirmacionSiDuplicado(crearPoroyectoDto.latitud, crearPoroyectoDto.longitud, crearPoroyectoDto.confirmarCercania);
        const proyecto = this.proyectoRepository.create({
            nombre: crearPoroyectoDto.nombre,
            descripcion: crearPoroyectoDto.descripcion ?? '',
            imagenPortada: crearPoroyectoDto.imagenPortada,
            direccion: crearPoroyectoDto.direccion ?? null,
            latitud: crearPoroyectoDto.latitud ?? null,
            longitud: crearPoroyectoDto.longitud ?? null,
            etapa: crearPoroyectoDto.etapa ?? null,
            fechaEntrega: crearPoroyectoDto.fechaEntrega ?? null,
            salaDireccion: crearPoroyectoDto.salaDireccion ?? null,
            salaHorario: crearPoroyectoDto.salaHorario ?? null,
            salaTelefono: crearPoroyectoDto.salaTelefono ?? null,
            salaLatitud: crearPoroyectoDto.salaLatitud ?? null,
            salaLongitud: crearPoroyectoDto.salaLongitud ?? null,
            ciudad
        });
        const guardado = await this.proyectoRepository.save(proyecto);
        this.recalcularEntornoEnSegundoPlano(guardado);
        return guardado;
    }

    async actualizarProyecto(id:string, actualizarProyectoDto: ActualizarProyectoDto): Promise<Proyecto>{
        const proyecto = await this.obtenerProyectoPorID(id);
        const {id_ciudad, confirmarCercania, ...cambios} = actualizarProyectoDto;
        if(id_ciudad !== undefined){
            proyecto.ciudad = await this.buscarCiudad(id_ciudad);
        }
        const cambiaUbicacion = (cambios.latitud !== undefined && cambios.latitud !== proyecto.latitud)
            || (cambios.longitud !== undefined && cambios.longitud !== proyecto.longitud);
        if(cambiaUbicacion){
            await this.exigirConfirmacionSiDuplicado(cambios.latitud ?? proyecto.latitud, cambios.longitud ?? proyecto.longitud, confirmarCercania, id);
        }
        Object.assign(proyecto, cambios);
        if(cambiaUbicacion){
            // El entorno guardado ya no corresponde a la nueva ubicación
            Object.assign(proyecto, {entorno:null, entornoActualizadoEn:null});
        }
        const guardado = await this.proyectoRepository.save(proyecto);
        if(cambiaUbicacion){
            this.recalcularEntornoEnSegundoPlano(guardado);
        }
        return guardado;
    }

    async obtenerEntorno(id:string): Promise<{entorno:Entorno, actualizadoEn:Date}>{
        const proyecto = await this.proyectoRepository.findOne({
            where:{id, activo:true},
            select:{id:true, entorno:true, entornoActualizadoEn:true},
        });
        if(!proyecto?.entorno || !proyecto.entornoActualizadoEn){
            throw new NotFoundException('El proyecto aún no tiene información del entorno');
        }
        return {entorno:proyecto.entorno, actualizadoEn:proyecto.entornoActualizadoEn};
    }

    // Consulta OpenStreetMap y guarda el resultado (lo usa el admin para reintentar o refrescar)
    async actualizarEntorno(id:string): Promise<{entorno:Entorno, actualizadoEn:Date}>{
        const proyecto = await this.obtenerProyectoPorID(id);
        if(proyecto.latitud === null || proyecto.longitud === null){
            throw new BadRequestException('El proyecto no tiene coordenadas');
        }
        const entorno = await this.entornoService.calcular(proyecto.latitud, proyecto.longitud);
        const actualizadoEn = new Date();
        await this.proyectoRepository.update({id}, {entorno, entornoActualizadoEn:actualizadoEn});
        return {entorno, actualizadoEn};
    }

    // Se avisa, no se bloquea: dos proyectos casi en el mismo punto pueden ser legítimos (p. ej. etapas en el mismo
    // terreno). Sin `confirmarCercania` responde 409 con los proyectos cercanos, para que el admin decida.
    // Cuenta también los despublicados: suele ser el mismo proyecto creado de nuevo.
    // shortcut: compara en memoria contra todos los proyectos con ubicación; con miles, filtrar por un recuadro en la consulta
    private async exigirConfirmacionSiDuplicado(latitud:number | null | undefined, longitud:number | null | undefined, confirmado?:boolean, excluirId?:string){
        if(latitud == null || longitud == null || confirmado) return;
        const otros = await this.proyectoRepository.find({
            where:{latitud:Not(IsNull()), longitud:Not(IsNull())},
            select:{id:true, nombre:true, activo:true, latitud:true, longitud:true},
            loadEagerRelations:false,
        });
        const cercanos = otros
            .filter((p) => p.id !== excluirId)
            .map((p) => ({id:p.id, nombre:p.nombre, activo:p.activo, distancia:Math.round(distanciaMetros(latitud, longitud, Number(p.latitud), Number(p.longitud)))}))
            .filter((p) => p.distancia < DISTANCIA_DUPLICADO_M)
            .sort((a, b) => a.distancia - b.distancia);
        if(cercanos.length > 0){
            const [primero] = cercanos;
            throw new ConflictException({
                statusCode:409,
                error:'Conflict',
                message:`El punto está a ${primero.distancia} m del proyecto «${primero.nombre}»${primero.activo ? '' : ' (despublicado)'}. Si es otro proyecto en el mismo lugar, confirma para guardar.`,
                cercanos,
            });
        }
    }

    private recalcularEntornoEnSegundoPlano(proyecto:Proyecto){
        if(proyecto.latitud === null || proyecto.longitud === null){
            return;
        }
        this.actualizarEntorno(proyecto.id).catch((error) =>
            this.logger.warn(`No se pudo calcular el entorno de ${proyecto.id}: ${(error as Error).message}`));
    }

    mostrarProyectos(id_ciudad?:number):Promise<Proyecto[]>{
        return this.proyectoRepository.find({
            where:id_ciudad?{activo:true, ciudad:{id:id_ciudad}}:{activo:true}, order:{nombre:'ASC'}
        });
    }

    // Borrado lógico: el proyecto y sus modelos dejan de verse en el catálogo (las consultas filtran proyecto.activo)
    async despublicarProyecto(id:string): Promise<void>{
        const resultado = await this.proyectoRepository.update({id, activo:true}, {activo:false});
        if(!resultado.affected){
            throw new NotFoundException('El proyecto no fue encontrado');
        }
    }

    // Borrado definitivo del proyecto con sus modelos, solo si ninguno tiene solicitudes de clientes (mismo criterio que
    // ModeloCasaService.eliminarModeloCasa: solicitudes y reservas no se pierden). La normativa se borra en cascada.
    async eliminarProyecto(id:string): Promise<{nombre:string}>{
        return this.proyectoRepository.manager.transaction(async (manager) => {
            const proyecto = await manager.findOne(Proyecto, {where:{id}, select:{id:true, nombre:true}, loadEagerRelations:false});
            if(!proyecto){
                throw new NotFoundException('El proyecto no fue encontrado');
            }
            const modelos = await manager.find(ModeloCasa, {where:{proyecto:{id}}, select:{id:true, nombreModelo:true}, loadEagerRelations:false});
            const conSolicitudes: string[] = [];
            for(const modelo of modelos){
                if(await manager.count(Solicitud, {where:{modeloCasa:{id:modelo.id}}}) > 0) conSolicitudes.push(`«${modelo.nombreModelo}»`);
            }
            if(conSolicitudes.length > 0){
                const varios = conSolicitudes.length > 1;
                throw new ConflictException(`No se puede eliminar «${proyecto.nombre}»: ${varios ? 'los modelos' : 'el modelo'} ${conSolicitudes.join(', ')} ${varios ? 'tienen' : 'tiene'} solicitudes de clientes. Despublica el proyecto para sacarlo del catálogo.`);
            }
            if(modelos.length > 0){
                await manager.delete(ModeloCasa, {id:In(modelos.map((m) => m.id))});
            }
            await manager.delete(Proyecto, {id});
            return {nombre:proyecto.nombre};
        });
    }

    // Deshace el despublicar: el proyecto y sus modelos activos vuelven al catálogo
    async publicarProyecto(id:string): Promise<void>{
        const resultado = await this.proyectoRepository.update({id, activo:false}, {activo:true});
        if(!resultado.affected){
            throw new NotFoundException('El proyecto no existe o ya está publicado');
        }
    }

    // Panel del admin: incluye los despublicados (primero los publicados) para poder volver a publicarlos
    listarProyectosAdmin():Promise<Proyecto[]>{
        return this.proyectoRepository.find({order:{activo:'DESC', nombre:'ASC'}});
    }

    async obtenerProyectoPorID(id:string): Promise<Proyecto>{
        const proyecto = await this.proyectoRepository.findOne({where:{id,activo:true}});
        if(!proyecto){
            throw new NotFoundException('El proyecto no fue encontrado');
        }
        return proyecto;
    }

    async obtenerNormativa(id:string): Promise<NormativaProyecto>{
        const normativa = await this.normativaRepository.findOne({where:{proyecto:{id, activo:true}}});
        if(!normativa){
            throw new NotFoundException('El proyecto no tiene ficha de normativa');
        }
        return normativa;
    }

    // Crea o reemplaza la ficha de normativa del proyecto
    async guardarNormativa(id:string, normativaDto: NormativaDto): Promise<NormativaProyecto>{
        const proyecto = await this.obtenerProyectoPorID(id);
        const existente = await this.normativaRepository.findOne({where:{proyecto:{id}}});

        const normativa = this.normativaRepository.create({
            ...existente,
            alturaMaximaMetros: null,
            alturaMaximaPisos: null,
            densidadMaxima: null,
            coefConstructibilidad: null,
            coefOcupacionSuelo: null,
            urlOrdenanza: null,
            observaciones: null,
            riesgos: [],
            ...normativaDto,
            proyecto,
        });
        await this.normativaRepository.save(normativa);
        return this.obtenerNormativa(id);
    }

    private async buscarCiudad(id_ciudad:number): Promise<Ciudad>{
        const ciudad = await this.ciudadRepository.findOne({where:{id:id_ciudad}});
        if(!ciudad){
            throw new NotFoundException('La ciudad seleccionada no existe en la bd');
        }
        return ciudad;
    }
}
