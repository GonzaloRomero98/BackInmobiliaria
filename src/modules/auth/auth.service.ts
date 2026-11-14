import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { LessThan, Repository } from "typeorm";
import { randomUUID } from "crypto";
import { UsuarioService } from "../usuario/usuario.service";
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from "./dto/login.dto";
import { SesionCerrada } from "./entities/sesionCerrada.entity";
import * as bcrypt from 'bcrypt'

// Bloqueo por correo e IP además del límite por IP: tras 5 fallos ese correo queda bloqueado 15 minutos desde esa IP.
// Es por correo e IP, y no solo por correo, para que nadie pueda dejar fuera al admin fallando a propósito desde otra IP.
export const MAX_INTENTOS_FALLIDOS = 5;
export const BLOQUEO_MS = 15 * 60_000;

// Mismo costo que las contraseñas reales, para que la comparación tarde lo mismo.
const HASH_RELLENO = bcrypt.hashSync('relleno-sin-uso', 10);

@Injectable()
export class AuthService{
    // Mejora pendiente: el contador está en memoria, se pierde al reiniciar y no se comparte entre instancias.
    // Con más de una instancia habría que moverlo a la BD o a Redis.
    private readonly fallidos = new Map<string, {intentos:number, ultimo:number}>();
    private readonly logger = new Logger('Auth');

    constructor(private readonly usuarioService:UsuarioService,
        private readonly jwtService: JwtService,
        @InjectRepository(SesionCerrada)
        private readonly sesionesCerradas: Repository<SesionCerrada>,
    ){}

    async loginUsuario(loginDto:LoginDto, ip = ''){
        // También cuenta para correos que no existen, así el bloqueo no revela qué cuentas hay.
        const clave = `${loginDto.correo.toLowerCase()}|${ip}`;
        const ahora = Date.now();
        const registro = this.fallidos.get(clave);
        if(registro && ahora - registro.ultimo >= BLOQUEO_MS){
            this.fallidos.delete(clave);
        }else if(registro && registro.intentos >= MAX_INTENTOS_FALLIDOS){
            throw new HttpException('Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.', HttpStatus.TOO_MANY_REQUESTS);
        }

        const usuario  = await this.usuarioService.usuarioPorCorreo(loginDto.correo);
        // bcrypt corre siempre, aunque el correo no exista, para que el tiempo de respuesta no revele qué cuentas hay (ISO 27001 A.8.5).
        const contrasenaValida = await bcrypt.compare(loginDto.contrasena, usuario?.contrasena ?? HASH_RELLENO);
        if(!usuario || !usuario.activo || !contrasenaValida){
            this.registrarFallo(clave, ahora);
            throw new UnauthorizedException('Credenciales incorrectas')
        }

        this.fallidos.delete(clave);
        return this.generarToken(usuario.id, usuario.correo, usuario.rol.nombre);
    }

    emitirToken(usuario:{id:string, correo:string, rol:string}){
        return {access_token: this.generarToken(usuario.id, usuario.correo, usuario.rol).access_token};
    }

    // Anota el token como cerrado para que deje de servir aunque alguien lo haya copiado. Solo afecta a ese dispositivo.
    // Un token inválido o vencido ya no sirve, así que no hace falta anotarlo.
    async cerrarSesion(token:string | null):Promise<void>{
        if(!token) return;
        const payload = await this.jwtService.verifyAsync<{jti?:string, exp:number}>(token).catch(() => null);
        if(!payload?.jti) return;
        await this.sesionesCerradas.save({jti:payload.jti, venceEn:new Date(payload.exp * 1000)});
    }

    // Pasado su vencimiento el token ya no sirve, así que su fila se puede borrar.
    @Cron(CronExpression.EVERY_DAY_AT_4AM, {timeZone:'America/Santiago'})
    async limpiarSesionesCerradas():Promise<number>{
        try{
            return (await this.sesionesCerradas.delete({venceEn:LessThan(new Date())})).affected ?? 0;
        }catch(error){
            this.logger.error(`No se pudieron limpiar las sesiones cerradas: ${(error as Error).message}`);
            return 0;
        }
    }

    private registrarFallo(clave:string, ahora:number){
        // Limpia los registros vencidos para que el mapa no crezca con correos inventados.
        if(this.fallidos.size > 10_000){
            for(const [k, r] of this.fallidos) if(ahora - r.ultimo >= BLOQUEO_MS) this.fallidos.delete(k);
        }
        const intentos = (this.fallidos.get(clave)?.intentos ?? 0) + 1;
        this.fallidos.set(clave, {intentos, ultimo:ahora});
    }

    private generarToken(id:string, correo:string, rol:string){
        // jti identifica este token, para poder cerrar solo esta sesión.
        const payload = {
            sub:id,
            correo,
            rol,
            jti:randomUUID(),
        };
        return{
            access_token: this.jwtService.sign(payload),
            usuario:{id, correo, rol},
        };
    }
}