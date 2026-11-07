import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { S3Service } from "./s3.service";
import { PresginedUrlDto } from "./dto/presigned-url.dto";
import { Roles } from "../auth/decorator/rol.decorator";
import { JwtAuthGuard } from "../auth/guards/jwtAuth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { RolUsuario } from "../rol/rol.enum";

@ApiTags('s3')
@ApiBearerAuth()
@Controller('s3')
export class S3Controller{
    constructor(private readonly s3Service:S3Service){}

    // El SECRETARIO solo puede subir su foto de perfil; el resto de carpetas es del ADMIN
    @Post('presigned-url')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN, RolUsuario.SECRETARIO)
    obtenerUrl(@Body() presignedUrldto:PresginedUrlDto, @Req() req:Request & {user:{rol:string}}){
        if(req.user.rol !== RolUsuario.ADMIN && presignedUrldto.carpeta !== 'perfiles'){
            throw new ForbiddenException('No tienes permiso para subir archivos a esta carpeta');
        }
        return this.s3Service.obtenerUrl(presignedUrldto.contentType, presignedUrldto.tamano, presignedUrldto.carpeta);
    }
}
