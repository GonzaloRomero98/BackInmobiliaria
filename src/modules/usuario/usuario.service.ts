import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Usuario } from "./entities/usuario.entity";
import { Repository } from "typeorm";
import { CrearUsuarioDto } from "./dto/crearUsuario.dto";
import * as bcrypt from 'bcrypt';
import { RolService } from "../rol/rol.service";

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

    async usuarioPorId(id:string): Promise<Usuario|null>{
        return this.usarioRepositorio.findOne({where: {id}});
    }

    async usuarioPorCorreo(correo:string):Promise<Usuario|null>{
        return this.usarioRepositorio.findOne({where:{correo}});
    }
}