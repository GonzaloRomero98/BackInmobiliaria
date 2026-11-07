import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Usuario } from "./entities/usuario.entity";
import { Not, Repository } from "typeorm";
import { CrearUsuarioDto } from "./dto/crearUsuario.dto";
import { ActualizarUsuarioDto } from "./dto/actualizarUsuario.dto";
import { CambiarContrasenaDto } from "./dto/cambiarContrasena.dto";
import { ActualizarPerfilDto } from "./dto/actualizarPerfil.dto";
import * as bcrypt from 'bcrypt';
import { RolService } from "../rol/rol.service";
import { S3Service } from "../s3/s3.service";

// El hash de la contraseña (ni cuándo se cambió) nunca sale de la API
export function sinContrasena({contrasena: _hash, contrasenaCambiadaEn: _cambio, ...usuario}: Usuario){
    return usuario;
}

@Injectable()
export class UsuarioService{
    private readonly logger = new Logger('Usuarios');

    constructor(
        @InjectRepository(Usuario)
        private readonly usarioRepositorio: Repository<Usuario>,
        private readonly rolService: RolService,
        private readonly s3Service: S3Service
    ){}


    async crearUsuario(usuarioDto: CrearUsuarioDto):Promise<Usuario>{
        const existe = await this.usarioRepositorio.findOne({
            where:{ correo:usuarioDto.correo},
        });
        if(existe){
            throw new ConflictException('Ya existe un  usuario para este correo');
        }

        const {rol:nombreRol, ...datos } = usuarioDto;
        const rol = await this.rolService.ObtenerRolByNombre(nombreRol);
        if(!rol){
            throw new BadRequestException('El rol no se encuentra en la base de datos');
        }

        const contrasenaHash = await bcrypt.hash(usuarioDto.contrasena, 10);

        const usuario = this.usarioRepositorio.create({
            ...datos, contrasena: contrasenaHash, rol
        });

        return this.usarioRepositorio.save(usuario);
    }

    async listarUsuarios(){
        const usuarios = await this.usarioRepositorio.find({order:{creadoEn:'ASC'}});
        return usuarios.map(sinContrasena);
    }

    async actualizarUsuario(id:string, dto:ActualizarUsuarioDto, idSolicitante:string){
        // Evita que el admin se deje sin acceso a sí mismo
        if(dto.activo === false && id === idSolicitante){
            throw new BadRequestException('No puedes desactivar tu propia cuenta');
        }
        const usuario = await this.usuarioPorId(id);
        if(!usuario){
            throw new NotFoundException('Usuario no encontrado');
        }
        if(dto.activo !== undefined) usuario.activo = dto.activo;
        if(dto.contrasena){
            usuario.contrasena = await bcrypt.hash(dto.contrasena, 10);
            usuario.contrasenaCambiadaEn = new Date(); // cierra las sesiones abiertas de esa cuenta
        }
        return sinContrasena(await this.usarioRepositorio.save(usuario));
    }

    async cambiarContrasena(id:string, dto:CambiarContrasenaDto):Promise<void>{
        const usuario = await this.usuarioPorId(id);
        if(!usuario || !(await bcrypt.compare(dto.actual, usuario.contrasena))){
            throw new BadRequestException('La contraseña actual no es correcta');
        }
        usuario.contrasena = await bcrypt.hash(dto.nueva, 10);
        usuario.contrasenaCambiadaEn = new Date(); // cierra las demás sesiones abiertas
        await this.usarioRepositorio.save(usuario);
    }

    async miPerfil(id:string){
        const usuario = await this.usuarioPorId(id);
        if(!usuario){
            throw new NotFoundException('Usuario no encontrado');
        }
        return sinContrasena(usuario);
    }

    async actualizarPerfil(id:string, dto:ActualizarPerfilDto){
        const usuario = await this.usuarioPorId(id);
        if(!usuario){
            throw new NotFoundException('Usuario no encontrado');
        }
        const fotoAnterior = usuario.fotoUrl;

        if(dto.nombre !== undefined) usuario.nombre = dto.nombre;
        if(dto.fotoUrl !== undefined && dto.fotoUrl !== fotoAnterior){
            if(dto.fotoUrl !== null){
                if(!this.s3Service.keyDeUrl(dto.fotoUrl, 'perfiles')){
                    throw new BadRequestException('La foto debe subirse desde el perfil');
                }
                // Si se aceptara la foto de otro usuario, al cambiarla después se le borraría a él
                if(await this.usarioRepositorio.findOne({where:{fotoUrl:dto.fotoUrl, id:Not(id)}})){
                    throw new ConflictException('Esa foto pertenece a otro usuario');
                }
            }
            usuario.fotoUrl = dto.fotoUrl;
        }

        const guardado = await this.usarioRepositorio.save(usuario);

        // Se borra después de guardar: si el guardado falla, la foto vigente sigue existiendo
        const keyAnterior = fotoAnterior && fotoAnterior !== usuario.fotoUrl ? this.s3Service.keyDeUrl(fotoAnterior, 'perfiles') : null;
        if(keyAnterior){
            await this.s3Service.eliminarArchivo(keyAnterior).catch((error:Error) =>
                this.logger.warn(`No se pudo borrar la foto anterior ${keyAnterior}: ${error.message}`));
        }
        return sinContrasena(guardado);
    }

    async usuarioPorId(id:string): Promise<Usuario|null>{
        return this.usarioRepositorio.findOne({where: {id}});
    }

    async usuarioPorCorreo(correo:string):Promise<Usuario|null>{
        return this.usarioRepositorio.findOne({where:{correo}});
    }
}