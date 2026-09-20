import { SetMetadata } from "@nestjs/common";
import { RolUsuario } from "../../rol/rol.enum";

export const ROL_KEY = 'roles';
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROL_KEY, roles);