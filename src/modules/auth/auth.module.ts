import { Module } from "@nestjs/common";
import { UsuarioModule } from "../usuario/usuario.module";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategy/jwt.strategy";

@Module({
    imports:[UsuarioModule, 
        PassportModule, 
        JwtModule.registerAsync({
            imports:[ConfigModule],
            inject:[ConfigService],
            useFactory: (config: ConfigService)=>({
                secret: config.get<string>('JWT_SECRET'),
                signOptions:{expiresIn: config.get('JWT_EXPIRES_IN')|| '8h'}
            }),
        }),
    ],
    controllers:[AuthController],
    providers:[AuthService, JwtStrategy],
    exports:[PassportModule, JwtModule]
})

export class AuthModule {}