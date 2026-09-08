import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolUsuario } from "../../usuario/entities/usuario.entity";
import { ROL_KEY } from "../decorator/rol.decorator";

@Injectable()
export class RolesGuard implements CanActivate{
    constructor(private readonly reflector:Reflector){}

    canActivate(context: ExecutionContext): boolean {
        const rolesRequeridos = this.reflector.getAllAndOverride<RolUsuario[]>(
            ROL_KEY,
            [context.getHandler(), context.getClass()],
        );

        if(!rolesRequeridos){
            return true;
        }

        const {user}= context.switchToHttp().getRequest();
        return rolesRequeridos.includes(user.rol); 
    }
}