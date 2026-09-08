import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Usuario } from "./entities/usuario.entity";
import { Repository } from "typeorm";
import { CrearUsuarioDto } from "./entities/crearUsuario.entity";
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsuarioService{
    constructor(
        @InjectRepository(Usuario)
        private readonly usarioRepositorio: Repository<Usuario>,
    ){}


    async crearUsuario(usuarioDto: CrearUsuarioDto):Promise<Usuario>{
        const existe = await this.usarioRepositorio.findOne({
            where:{ correo:usuarioDto.correo},
        });
        if(existe){
            throw new ConflictException('Ya existe un  usuario para este correo');
        }

        const contrasenaHash = await bcrypt.hash(usuarioDto.contrasena, 10);

        const usuario = this.usarioRepositorio.create({
            ...usuarioDto, contrasena: contrasenaHash,
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