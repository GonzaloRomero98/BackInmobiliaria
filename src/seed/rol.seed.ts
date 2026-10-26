import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppModule } from "../app.module";
import { Rol } from "../modules/rol/entities/rol.entity";
import { RolUsuario } from "../modules/rol/rol.enum";
import { UsuarioService } from "../modules/usuario/usuario.service";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CrearUsuarioDto } from "../modules/usuario/dto/crearUsuario.dto";

// Crea los roles que faltan y, si ADMIN_CORREO y ADMIN_CONTRASENA están definidos
// (en el .env o en el entorno), el primer usuario ADMIN.
async function boostrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const rolRepositorio = app.get<Repository<Rol>>(getRepositoryToken(Rol));
    const usuarioService = app.get(UsuarioService);
    const config = app.get(ConfigService);

    for(const nombre of Object.values(RolUsuario)){
        const existeRol = await rolRepositorio.findOne({where:{nombre}});
        if(!existeRol){
            await rolRepositorio.save(rolRepositorio.create({nombre}));
            console.log('rol creado:', nombre);
        }
    }

    const correo = config.get<string>('ADMIN_CORREO');
    const contrasena = config.get<string>('ADMIN_CONTRASENA');
    if(correo && contrasena){
        const existeAdmin = await usuarioService.usuarioPorCorreo(correo);
        if(!existeAdmin){
            const dto = plainToInstance(CrearUsuarioDto, {
                correo,
                contrasena,
                nombre: config.get<string>('ADMIN_NOMBRE') ?? 'Administrador',
                rol: RolUsuario.ADMIN,
            });
            // Misma validación (incluida la política de contraseñas) que el endpoint de registro
            const errores = await validate(dto);
            if(errores.length){
                console.error('datos del ADMIN inválidos:', errores.flatMap((e) => Object.values(e.constraints ?? {})).join('; '));
                await app.close();
                process.exit(1);
            }
            await usuarioService.crearUsuario(dto);
            console.log('usuario ADMIN creado:', correo);
        } else {
            console.log('el usuario ya existe, no se modifica:', correo);
        }
    } else {
        console.log('ADMIN_CORREO / ADMIN_CONTRASENA no definidos: no se crea usuario ADMIN');
    }

    await app.close();
}
boostrap();
