import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

// Prefijos de ruta y acciones internas que pertenecen a cada módulo.
export const MODULOS_AUDITORIA = {
    sesion: { rutas: ['/api/auth/'], acciones: [] },
    proyectos: { rutas: ['/api/proyectos'], acciones: [] },
    modelos: { rutas: ['/api/modeloCasa', '/api/caracteristicas'], acciones: [] },
    solicitudes: { rutas: ['/api/solicitudes'], acciones: ['EXPORTAR_SOLICITUDES', 'RETENCION_SOLICITUDES'] },
    reservas: { rutas: ['/api/reservas'], acciones: [] },
    usuarios: { rutas: ['/api/usuarios'], acciones: [] },
    archivos: { rutas: ['/api/s3/'], acciones: [] },
} as const;
export type ModuloAuditoria = keyof typeof MODULOS_AUDITORIA;

export class ListarAuditoriaDto{
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pagina: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limite: number = 50;

    @IsOptional()
    @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @MaxLength(100)
    correo?: string;

    @IsOptional()
    @IsIn(Object.keys(MODULOS_AUDITORIA))
    modulo?: ModuloAuditoria;

    @IsOptional()
    @Transform(({value}) => value === 'true' || value === true ? true : value === 'false' || value === false ? false : value)
    @IsBoolean()
    soloRechazados: boolean = false;

    @IsOptional()
    @IsISO8601({strict:true})
    desde?: string;

    @IsOptional()
    @IsISO8601({strict:true})
    hasta?: string;
}
