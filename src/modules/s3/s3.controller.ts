import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
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

    @Post('presigned-url')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(RolUsuario.ADMIN)
    obtenerUrl(@Body() presignedUrldto:PresginedUrlDto){
        return this.s3Service.obtenerUrl(presignedUrldto.contentType, presignedUrldto.tamano, presignedUrldto.carpeta);
    }
}
