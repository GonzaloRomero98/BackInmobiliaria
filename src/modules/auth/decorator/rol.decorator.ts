import { SetMetadata } from "@nestjs/common";
import { RolUsuario } from "../../usuario/entities/usuario.entity";

export const ROL_KEY = 'roles';
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROL_KEY, roles);