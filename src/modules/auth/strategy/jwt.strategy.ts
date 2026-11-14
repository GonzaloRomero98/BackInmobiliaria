import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import {PassportStrategy} from '@nestjs/passport'
import { Strategy } from "passport-jwt";
import { Repository } from "typeorm";
import { UsuarioService } from "../../usuario/usuario.service";
import { extraerToken } from "../cookie-sesion";
import { SesionCerrada } from "../entities/sesionCerrada.entity";
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){

    constructor(configService: ConfigService, private readonly usuarioService: UsuarioService,
        @InjectRepository(SesionCerrada) private readonly sesionesCerradas: Repository<SesionCerrada>){
        super({
            jwtFromRequest: extraerToken,
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>('JWT_SECRET')
        });
    }

    // Se consulta la BD en cada petición para que un usuario desactivado o una sesión cerrada pierdan el acceso de inmediato.
    async validate(payload:{sub:string, correo:string, rol:string, iat:number, jti?:string}) {
        const [usuario, cerrada] = await Promise.all([
            this.usuarioService.usuarioPorId(payload.sub),
            // Los tokens emitidos antes de que existiera jti no se pueden cerrar uno a uno, pero vencen a las 8 horas.
            payload.jti ? this.sesionesCerradas.exists({where:{jti:payload.jti}}) : false,
        ]);
        if(!usuario || !usuario.activo || cerrada){
            throw new UnauthorizedException('Sesión no válida');
        }
        // Después de cambiar la contraseña los tokens anteriores dejan de servir en todos los dispositivos.
        // iat viene en segundos, así que se acepta el token emitido en el mismo segundo del cambio.
        if(usuario.contrasenaCambiadaEn && payload.iat < Math.floor(usuario.contrasenaCambiadaEn.getTime() / 1000)){
            throw new UnauthorizedException('Sesión no válida');
        }
        return {id:usuario.id, correo:usuario.correo, rol:usuario.rol.nombre};
    }
}
