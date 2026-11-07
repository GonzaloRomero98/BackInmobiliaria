import { HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { UsuarioService } from "../usuario/usuario.service";
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from "./dto/login.dto";
import * as bcrypt from 'bcrypt'

// Bloqueo por cuenta (complementa el límite por IP): tras 5 fallos seguidos el correo queda
// bloqueado 15 minutos desde el último fallo, aunque el atacante cambie de IP.
export const MAX_INTENTOS_FALLIDOS = 5;
export const BLOQUEO_MS = 15 * 60_000;

// Mismo costo (10) que las contraseñas reales, para que la comparación tarde lo mismo
const HASH_RELLENO = bcrypt.hashSync('relleno-sin-uso', 10);

@Injectable()
export class AuthService{
    // shortcut: contador en memoria, se reinicia al reiniciar la API y no se comparte entre instancias; pasar a BD/Redis si hay más de una instancia
    private readonly fallidos = new Map<string, {intentos:number, ultimo:number}>();

    constructor(private readonly usuarioService:UsuarioService,
        private readonly jwtService: JwtService
    ){}

    async loginUsuario(loginDto:LoginDto){
        // Se cuenta también para correos inexistentes: el bloqueo no revela qué cuentas existen
        const clave = loginDto.correo.toLowerCase();
        const ahora = Date.now();
        const registro = this.fallidos.get(clave);
        if(registro && ahora - registro.ultimo >= BLOQUEO_MS){
            this.fallidos.delete(clave);
        }else if(registro && registro.intentos >= MAX_INTENTOS_FALLIDOS){
            throw new HttpException('Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.', HttpStatus.TOO_MANY_REQUESTS);
        }

        const usuario  = await this.usuarioService.usuarioPorCorreo(loginDto.correo);
        // bcrypt corre siempre (contra un hash de relleno si el correo no existe): así el tiempo de
        // respuesta no revela qué correos tienen cuenta (ISO 27001 A.8.5)
        const contrasenaValida = await bcrypt.compare(loginDto.contrasena, usuario?.contrasena ?? HASH_RELLENO);
        if(!usuario || !usuario.activo || !contrasenaValida){
            this.registrarFallo(clave, ahora);
            throw new UnauthorizedException('Credenciales incorrectas')
        }

        this.fallidos.delete(clave);
        return this.generarToken(usuario.id, usuario.correo, usuario.rol.nombre);
    }

    // Token nuevo para el usuario ya autenticado (p. ej. tras cambiar su contraseña, que invalida los anteriores)
    emitirToken(usuario:{id:string, correo:string, rol:string}){
        return {access_token: this.generarToken(usuario.id, usuario.correo, usuario.rol).access_token};
    }

    private registrarFallo(clave:string, ahora:number){
        // Limpieza de vencidos para que el mapa no crezca con correos inventados
        if(this.fallidos.size > 10_000){
            for(const [k, r] of this.fallidos) if(ahora - r.ultimo >= BLOQUEO_MS) this.fallidos.delete(k);
        }
        const intentos = (this.fallidos.get(clave)?.intentos ?? 0) + 1;
        this.fallidos.set(clave, {intentos, ultimo:ahora});
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