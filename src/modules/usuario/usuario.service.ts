import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Usuario } from "./entities/usuario.entity";
import { Repository } from "typeorm";
import { CrearUsuarioDto } from "./dto/crearUsuario.dto";
import { ActualizarUsuarioDto } from "./dto/actualizarUsuario.dto";
import { CambiarContrasenaDto } from "./dto/cambiarContrasena.dto";
import * as bcrypt from 'bcrypt';
import { RolService } from "../rol/rol.service";

// El hash de la contraseña nunca sale de la API
export function sinContrasena({contrasena: _hash, ...usuario}: Usuario){
    return usuario;
}

@Injectable()
export class UsuarioService{
    constructor(
        @InjectRepository(Usuario)
        private readonly usarioRepositorio: Repository<Usuario>,
        private readonly rolService: RolService
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
        if(dto.contrasena) usuario.contrasena = await bcrypt.hash(dto.contrasena, 10);
        return sinContrasena(await this.usarioRepositorio.save(usuario));
    }

    async cambiarContrasena(id:string, dto:CambiarContrasenaDto):Promise<void>{
        const usuario = await this.usuarioPorId(id);
        if(!usuario || !(await bcrypt.compare(dto.actual, usuario.contrasena))){
            throw new BadRequestException('La contraseña actual no es correcta');
        }
        usuario.contrasena = await bcrypt.hash(dto.nueva, 10);
        await this.usarioRepositorio.save(usuario);
    }

    async usuarioPorId(id:string): Promise<Usuario|null>{
        return this.usarioRepositorio.findOne({where: {id}});
    }

    async usuarioPorCorreo(correo:string):Promise<Usuario|null>{
        return this.usarioRepositorio.findOne({where:{correo}});
    }
}