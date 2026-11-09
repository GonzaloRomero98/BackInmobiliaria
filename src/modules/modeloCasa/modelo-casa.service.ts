import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ModeloCasa } from "./entities/modeloCasa.entity";
import { Between, FindOptionsOrder, FindOptionsWhere, In, LessThanOrEqual, MoreThanOrEqual, Repository } from "typeorm";
import { Proyecto } from "../proyecto/entities/proyecto.entity";
import { CrearModeloCasaDto } from "./dto/CrearModeloCasa.dto";
import { Caracteristica } from "../caracteristicas/entities/caracteristica.entity";
import { GaleriaModeloCasa } from "./entities/galeriaModeloCasa.entity";
import { AgregarFotoDto } from "./dto/agregarFoto.dto";
import { ActualizarModeloCasaDto } from "./dto/actualizarModeloCasa.dto";
import { FiltrosModeloCasaDto, OrdenModelo } from "./dto/filtrosModeloCasa.dto";
import { calcularEstado, EstadoModelo, TipoVivienda } from "./modelo-casa.enum";

const ORDEN: Record<OrdenModelo, FindOptionsOrder<ModeloCasa>> = {
    precio_asc: {precio:'ASC'},
    precio_desc: {precio:'DESC'},
    superficie_desc: {superficieConstruida:'DESC'},
    recientes: {creadoEn:'DESC'},
};

function rango(min?:number, max?:number){
    if(min !== undefined && max !== undefined) return Between(min, max);
    if(min !== undefined) return MoreThanOrEqual(min);
    if(max !== undefined) return LessThanOrEqual(max);
    return undefined;
}

@Injectable()
export class ModeloCasaService{
    constructor(
        @InjectRepository(ModeloCasa)
        private readonly modeloCasaRepository: Repository<ModeloCasa>,
        @InjectRepository(Proyecto)
        private readonly proyectoRepository: Repository<Proyecto>,
        @InjectRepository(Caracteristica)
        private readonly caracteristicaRepository: Repository<Caracteristica>,
        @InjectRepository(GaleriaModeloCasa)
        private readonly galeriaRepository: Repository<GaleriaModeloCasa>
    ){}

    async crearModeloCasa(crearModeloCasaDto:CrearModeloCasaDto):Promise<ModeloCasa>{
        const proyecto = await this.proyectoRepository.findOne({where:{id:crearModeloCasaDto.id_proyecto}});
        if(!proyecto){
            throw new NotFoundException('No se encuentra el proyecto');
        }

        const modeloCasa = new ModeloCasa();
            modeloCasa.proyecto = proyecto;
            modeloCasa.nombreModelo = crearModeloCasaDto.nombreModelo;
            modeloCasa.tipoOperacion = crearModeloCasaDto.tipoOperacion;
            modeloCasa.dormitorios = crearModeloCasaDto.dormitorios;
            modeloCasa.banos = crearModeloCasaDto.banos;
            modeloCasa.estacionamientos = crearModeloCasaDto.estacionamiento;
            modeloCasa.mascotas = crearModeloCasaDto.mascotas;
            modeloCasa.superficieConstruida = crearModeloCasaDto.superficieConstruida;
            modeloCasa.tipoVivienda = crearModeloCasaDto.tipoVivienda ?? TipoVivienda.CASA;
            modeloCasa.superficieTerreno = crearModeloCasaDto.superficieTerreno ?? null;
            modeloCasa.precio = crearModeloCasaDto.precio;
            modeloCasa.moneda = crearModeloCasaDto.moneda;
            modeloCasa.gastosComunes = crearModeloCasaDto.gastosComunes ?? null;
            modeloCasa.modelo3dUrl = crearModeloCasaDto.modelo3dUrl ?? null;
            modeloCasa.planoUrl = crearModeloCasaDto.planoUrl ?? null;
            modeloCasa.subsidios = crearModeloCasaDto.subsidios ?? [];
            modeloCasa.bono = crearModeloCasaDto.bono?.trim() || null;
            modeloCasa.imgPrincipal = crearModeloCasaDto.imgPrincipal;
            modeloCasa.caracteristicas = await this.buscarCaracteristicas(crearModeloCasaDto.caracteristicasID);
            modeloCasa.unidades = crearModeloCasaDto.unidades ?? 1;
            modeloCasa.estado = calcularEstado(modeloCasa.unidades, 0, 0);
            modeloCasa.activo = crearModeloCasaDto.activo ?? true;
        this.exigirTerrenoEnCasas(modeloCasa);

        const existeCasa = await this.modeloCasaRepository.findOne({where:{nombreModelo:modeloCasa.nombreModelo}});

        if(existeCasa){
            throw new ConflictException("Ya se ha ingresado esta propiedad")
        }

        return this.modeloCasaRepository.save(modeloCasa)

    }

    async actualizarModeloCasa(id:string, actualizarModeloCasaDto:ActualizarModeloCasaDto):Promise<ModeloCasa>{
        const modelo = await this.obtenerModeloAdmin(id);
        const {id_proyecto, estacionamiento, caracteristicasID, ...cambios} = actualizarModeloCasaDto;

        if(id_proyecto !== undefined){
            const proyecto = await this.proyectoRepository.findOne({where:{id:id_proyecto}});
            if(!proyecto){
                throw new NotFoundException('No se encuentra el proyecto');
            }
            modelo.proyecto = proyecto;
        }
        if(estacionamiento !== undefined) modelo.estacionamientos = estacionamiento;
        if(caracteristicasID !== undefined) modelo.caracteristicas = await this.buscarCaracteristicas(caracteristicasID);

        if(cambios.nombreModelo !== undefined && cambios.nombreModelo !== modelo.nombreModelo){
            const existeCasa = await this.modeloCasaRepository.findOne({where:{nombreModelo:cambios.nombreModelo}});
            if(existeCasa){
                throw new ConflictException("Ya se ha ingresado esta propiedad");
            }
        }

        Object.assign(modelo, cambios);
        if(cambios.bono !== undefined) modelo.bono = cambios.bono?.trim() || null;
        // Se valida el resultado combinado: p. ej. pasar un departamento sin terreno a casa
        this.exigirTerrenoEnCasas(modelo);

        // save() escribe todas las columnas: los contadores se releen con la fila bloqueada (igual que ReservaService)
        // para no pisar una reserva confirmada mientras se editaba
        return this.modeloCasaRepository.manager.transaction(async (manager) => {
            const actual = await manager.findOne(ModeloCasa, {where:{id}, lock:{mode:'pessimistic_write'}, loadEagerRelations:false});
            if(!actual){
                throw new NotFoundException('No se encontro el modelo de la casa');
            }
            modelo.unidadesReservadas = actual.unidadesReservadas;
            modelo.unidadesVendidas = actual.unidadesVendidas;
            const ocupadas = modelo.unidadesReservadas + modelo.unidadesVendidas;
            if(cambios.unidades !== undefined && cambios.unidades < ocupadas){
                throw new BadRequestException(`Hay ${ocupadas} unidades reservadas o vendidas`);
            }
            modelo.estado = calcularEstado(modelo.unidades, modelo.unidadesReservadas, modelo.unidadesVendidas);
            return manager.save(ModeloCasa, modelo);
        });
    }

    private exigirTerrenoEnCasas(modelo:ModeloCasa){
        if(modelo.tipoVivienda === TipoVivienda.CASA && modelo.superficieTerreno == null){
            throw new BadRequestException('La superficie de terreno es obligatoria en una casa');
        }
    }

    // La copia nace como borrador DISPONIBLE y reutiliza las mismas URLs de S3: no sube ni copia archivos,
    // así que no hay nada que limpiar en S3 si falla (y eliminarFoto solo borra la fila, nunca el archivo).
    // Un solo save con cascada: modelo y galería se insertan en una transacción, o no se inserta nada.
    // El nombre lo elige el admin; si ya existe se rechaza, sin inventar sufijos.
    async duplicarModeloCasa(id:string, nombreModelo:string):Promise<ModeloCasa>{
        const {id:_id, creadoEn:_creadoEn, fotos, ...datos} = await this.obtenerModeloAdmin(id);

        if(await this.modeloCasaRepository.findOne({where:{nombreModelo}})){
            throw new ConflictException(`Ya existe un modelo con el nombre "${nombreModelo}". Elige otro nombre.`);
        }

        return this.modeloCasaRepository.save(Object.assign(new ModeloCasa(), datos, {
            nombreModelo, activo:false, estado:EstadoModelo.DISPONIBLE, unidadesReservadas:0, unidadesVendidas:0,
            fotos:(fotos ?? []).map(({urlImagen, orden}) => Object.assign(new GaleriaModeloCasa(), {urlImagen, orden})),
        }));
    }

    // El formulario lo consulta antes de subir la imagen y el .glb a S3: con un nombre repetido no se sube nada.
    // Misma regla que crear/actualizar (coincidencia exacta); excluirId = el modelo que se está editando.
    async nombreDisponible(nombreModelo:string, excluirId?:string):Promise<{disponible:boolean}>{
        const existente = await this.modeloCasaRepository.findOne({where:{nombreModelo}});
        return {disponible: !existente || existente.id === excluirId};
    }

    async despublicarModeloCasa(id:string):Promise<void>{
        const resultado = await this.modeloCasaRepository.update({id, activo:true}, {activo:false});
        if(!resultado.affected){
            throw new NotFoundException('No se encontro el modelo de la casa');
        }
    }

    private async buscarCaracteristicas(ids:number[] = []):Promise<Caracteristica[]>{
        if(!ids.length) return [];
        const unicos = [... new Set(ids)];
        const caracteristicas = await this.caracteristicaRepository.findBy({id:In(unicos)});
        if(caracteristicas.length !== unicos.length){
            throw new BadRequestException('Algunas caracteristicas seleccionadas no existen');
        }
        return caracteristicas;
    }

    mostrarModelosCasa(filtros: FiltrosModeloCasaDto = {}):Promise<ModeloCasa[]>{
        const ciudad = filtros.id_ciudad || filtros.id_region
            ? {...(filtros.id_ciudad && {id:filtros.id_ciudad}), ...(filtros.id_region && {region:{id:filtros.id_region}})}
            : undefined;

        const filtro : FindOptionsWhere<ModeloCasa> = {
            activo:true,
            proyecto: {activo:true, ...(filtros.id_proyecto && {id:filtros.id_proyecto}), ...(ciudad && {ciudad})},
            ...(filtros.tipoOperacion && {tipoOperacion:filtros.tipoOperacion}),
            ...(filtros.moneda && {moneda:filtros.moneda}),
            ...(filtros.mascotas !== undefined && {mascotas:filtros.mascotas}),
        };

        const precio = rango(filtros.precioMin, filtros.precioMax);
        if(precio) filtro.precio = precio;
        if(filtros.dormitorios !== undefined) filtro.dormitorios = MoreThanOrEqual(filtros.dormitorios);
        if(filtros.banos !== undefined) filtro.banos = MoreThanOrEqual(filtros.banos);
        if(filtros.superficieMin !== undefined) filtro.superficieConstruida = MoreThanOrEqual(filtros.superficieMin);

        const orden = filtros.orden ? ORDEN[filtros.orden] : {nombreModelo:'ASC' as const};
        return this.modeloCasaRepository.find({where:filtro, order:{...orden, fotos:{orden:'ASC'}}});
    }

    async obtenerModeloByID(id:string): Promise<ModeloCasa>{
        const modelo = await this.modeloCasaRepository.findOne({where:{id:id,activo:true,proyecto:{activo:true}},order:{fotos:{orden:'ASC'}}});

        if(!modelo){
            throw new NotFoundException('No se encontro el modelo de la casa');
        }

        return modelo;
    }

    // Panel admin: incluye borradores y modelos de proyectos despublicados
    listarModelosAdmin():Promise<ModeloCasa[]>{
        return this.modeloCasaRepository.find({order:{nombreModelo:'ASC', fotos:{orden:'ASC'}}});
    }

    async obtenerModeloAdmin(id:string):Promise<ModeloCasa>{
        const modelo = await this.modeloCasaRepository.findOne({where:{id}, order:{fotos:{orden:'ASC'}}});
        if(!modelo){
            throw new NotFoundException('No se encontro el modelo de la casa');
        }
        return modelo;
    }

    async agregarFoto(id:string, agregarFotoDto: AgregarFotoDto){
        const modelo = await this.modeloCasaRepository.findOne({where:{id}});
        if(!modelo){
            throw new NotFoundException('Modelo de la casa no encontrado');
        }

        const existeFoto = await this.galeriaRepository.findOne({where:{urlImagen:agregarFotoDto.urlImagen, modeloCasa:{id}}});

        if(existeFoto){
            throw new ConflictException('Esta foto ya esta en la galeria del modelo de casa')
        }

        const foto = new GaleriaModeloCasa();
            foto.modeloCasa = modelo;
            foto.urlImagen = agregarFotoDto.urlImagen;
            foto.orden = agregarFotoDto.orden ?? await this.galeriaRepository.count({where:{modeloCasa:{id}}});

        const guardarFoto = await this.galeriaRepository.save(foto);
        return {id:guardarFoto.id, urlImagen:guardarFoto.urlImagen, orden:guardarFoto.orden};
    }

    async eliminarFoto(id:string, foto_id:string):Promise<void>{
        const foto = await this.galeriaRepository.findOne({where:{id:foto_id, modeloCasa:{id}}});

        if(!foto){
            throw new NotFoundException('Foto no encontrada');
        }

        await this.galeriaRepository.remove(foto);
    }

    // Exige la lista completa: un orden parcial dejaría posiciones repetidas con las fotos omitidas
    async ordenarFotos(id:string, ids:string[]){
        const fotos = await this.galeriaRepository.find({where:{modeloCasa:{id}}});
        const porId = new Map(fotos.map((f) => [f.id, f]));
        if(ids.length !== fotos.length || ids.some((fotoId) => !porId.has(fotoId))){
            throw new BadRequestException('La lista debe contener exactamente las fotos del modelo');
        }

        // save de un arreglo corre en una sola transacción
        const ordenadas = ids.map((fotoId, orden) => Object.assign(porId.get(fotoId)!, {orden}));
        await this.galeriaRepository.save(ordenadas);
        return ordenadas.map(({id:fotoId, urlImagen, orden}) => ({id:fotoId, urlImagen, orden}));
    }
}