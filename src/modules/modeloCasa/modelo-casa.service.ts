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
import { Solicitud } from "../solicitud/entities/solicitud.entity";

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
        this.exigirTerrenoEnCasas(modelo);

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

    // La copia queda como borrador y usa las mismas URLs de S3, así que no hay archivos que limpiar si falla.
    // Un solo save con cascada guarda el modelo y su galería en la misma transacción.
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

    // El formulario lo consulta antes de subir archivos a S3.
    async nombreDisponible(nombreModelo:string, excluirId?:string):Promise<{disponible:boolean}>{
        const existente = await this.modeloCasaRepository.findOne({where:{nombreModelo}});
        return {disponible: !existente || existente.id === excluirId};
    }

    // Borrado definitivo, solo si nadie lo ha solicitado, porque las solicitudes y reservas son datos de clientes.
    // Si entra una solicitud justo antes del borrado, la llave foránea rechaza el DELETE.
    // Mejora pendiente: los archivos quedan en S3, porque una copia del modelo puede usar los mismos.
    async eliminarModeloCasa(id:string):Promise<{nombre:string}>{
        return this.modeloCasaRepository.manager.transaction(async (manager) => {
            const modelo = await manager.findOne(ModeloCasa, {where:{id}, select:{id:true, nombreModelo:true}, loadEagerRelations:false});
            if(!modelo){
                throw new NotFoundException('No se encontro el modelo de la casa');
            }
            const solicitudes = await manager.count(Solicitud, {where:{modeloCasa:{id}}});
            if(solicitudes > 0){
                throw new ConflictException(`«${modelo.nombreModelo}» tiene ${solicitudes} ${solicitudes === 1 ? 'solicitud' : 'solicitudes'} de clientes y no se puede eliminar. Despublícalo para sacarlo del catálogo.`);
            }
            await manager.delete(ModeloCasa, {id});
            return {nombre:modelo.nombreModelo};
        });
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

    // Exige la lista completa, porque un orden parcial dejaría posiciones repetidas.
    async ordenarFotos(id:string, ids:string[]){
        const fotos = await this.galeriaRepository.find({where:{modeloCasa:{id}}});
        const porId = new Map(fotos.map((f) => [f.id, f]));
        if(ids.length !== fotos.length || ids.some((fotoId) => !porId.has(fotoId))){
            throw new BadRequestException('La lista debe contener exactamente las fotos del modelo');
        }

        const ordenadas = ids.map((fotoId, orden) => Object.assign(porId.get(fotoId)!, {orden}));
        await this.galeriaRepository.save(ordenadas);
        return ordenadas.map(({id:fotoId, urlImagen, orden}) => ({id:fotoId, urlImagen, orden}));
    }
}