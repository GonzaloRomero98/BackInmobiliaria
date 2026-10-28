import { Module } from "@nestjs/common";
import { UsuarioModule } from "../usuario/usuario.module";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategy/jwt.strategy";
import { UsuarioController } from "../usuario/usuario.controller";

@Module({
    imports:[UsuarioModule, 
        PassportModule.register({defaultStrategy:'jwt'}), 
        JwtModule.registerAsync({
            imports:[ConfigModule],
            inject:[ConfigService],
            useFactory: (config: ConfigService)=>({
                secret: config.get<string>('JWT_SECRET'),
                signOptions:{expiresIn: config.get('JWT_EXPIRES_IN')|| '8h'}
            }),
        }),
    ],
    // UsuarioController vive aquí: UsuarioModule no puede importar AuthModule (dependencia circular)
    controllers:[AuthController, UsuarioController],
    providers:[AuthService, JwtStrategy],
    exports:[PassportModule, JwtModule]
})

export class AuthModule {}