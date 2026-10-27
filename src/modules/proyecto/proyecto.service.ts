import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Proyecto } from "./entities/proyecto.entity";
import { Repository } from "typeorm";
import { Ciudad } from "../ubicacion/entities/ciudad.entity";
import { CrearProyectoDto } from "./dto/crearProyecto.dto";
import { ActualizarProyectoDto } from "./dto/actualizarProyecto.dto";
import { NormativaProyecto } from "./entities/normativaProyecto.entity";
import { NormativaDto } from "./dto/normativa.dto";
import { Entorno, EntornoService } from "./entorno.service";

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
        const proyecto = this.proyectoRepository.create({
            nombre: crearPoroyectoDto.nombre,
            descripcion: crearPoroyectoDto.descripcion ?? '',
            imagenPortada: crearPoroyectoDto.imagenPortada,
            direccion: crearPoroyectoDto.direccion ?? null,
            latitud: crearPoroyectoDto.latitud ?? null,
            longitud: crearPoroyectoDto.longitud ?? null,
            ciudad
        });
        const guardado = await this.proyectoRepository.save(proyecto);
        this.recalcularEntornoEnSegundoPlano(guardado);
        return guardado;
    }

    async actualizarProyecto(id:string, actualizarProyectoDto: ActualizarProyectoDto): Promise<Proyecto>{
        const proyecto = await this.obtenerProyectoPorID(id);
        const {id_ciudad, ...cambios} = actualizarProyectoDto;
        if(id_ciudad !== undefined){
            proyecto.ciudad = await this.buscarCiudad(id_ciudad);
        }
        const cambiaUbicacion = (cambios.latitud !== undefined && cambios.latitud !== proyecto.latitud)
            || (cambios.longitud !== undefined && cambios.longitud !== proyecto.longitud);
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
