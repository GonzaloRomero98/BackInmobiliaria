import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {PassportStrategy} from '@nestjs/passport'
import { ExtractJwt, Strategy } from "passport-jwt";
import { UsuarioService } from "../../usuario/usuario.service";
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){

    constructor(configService: ConfigService, private readonly usuarioService: UsuarioService){
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>('JWT_SECRET')
        });
    }

    // Se consulta la BD en cada petición: un usuario desactivado o con rol cambiado
    // pierde el acceso de inmediato, sin esperar a que venza su token.
    async validate(payload:{sub:string, correo:string, rol:string}) {
        const usuario = await this.usuarioService.usuarioPorId(payload.sub);
        if(!usuario || !usuario.activo){
            throw new UnauthorizedException('Sesión no válida');
        }
        return {id:usuario.id, correo:usuario.correo, rol:usuario.rol.nombre};
    }
}
