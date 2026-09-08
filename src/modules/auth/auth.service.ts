import { Injectable, UnauthorizedException } from "@nestjs/common";
import { UsuarioService } from "../usuario/usuario.service";
import { JwtService } from '@nestjs/jwt';
import { CrearUsuarioDto } from "../usuario/entities/crearUsuario.entity";
import { LoginDto } from "./dto/login.dto";
import * as bcrypt from 'bcrypt'

@Injectable()
export class AuthService{
    constructor(private readonly usuarioService:UsuarioService,
        private readonly jwtService: JwtService
    ){}

    async registrarUsuario(crearUsuarioDto: CrearUsuarioDto){
        const usuario = await this.usuarioService.crearUsuario(crearUsuarioDto);
        return this.generarToken(usuario.id, usuario.correo, usuario.rol);
    }

    async loginUsuario(loginDto:LoginDto){
        const usuario  = await this.usuarioService.usuarioPorCorreo(loginDto.correo);
        if(!usuario){
            throw new UnauthorizedException('Credenciales incorrectas')
        }

        const contrasenaValida = await bcrypt.compare(loginDto.contrasena, usuario.contrasena);
        if(!contrasenaValida){
            throw new UnauthorizedException('Credenciales incorrectas')
        }

        return this.generarToken(usuario.id, usuario.correo, usuario.rol);
    }

    private generarToken(id:string, correo:string, rol:string){
        const payload = {
            sub:id,
            correo, 
            rol
        };
        return{
            access_token: this.jwtService.sign(payload),
            usuario:{id, correo, rol},
        };
    }
}