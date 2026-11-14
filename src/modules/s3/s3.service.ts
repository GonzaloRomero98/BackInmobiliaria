import { BadRequestException, Injectable, PayloadTooLargeException } from "@nestjs/common";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { CarpetaS3, REGLAS_CARPETA } from "./s3.archivos";

@Injectable()
export class S3Service {
    private readonly awsS3Client: S3Client;
    private readonly awsBucketname: string;
    private readonly awsRegion: string;

    constructor(private readonly configService: ConfigService) {
        this.awsBucketname = this.configService.getOrThrow<string>('AWS_S3_BUCKET');
        this.awsRegion = this.configService.getOrThrow<string>('AWS_REGION');

        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
        this.awsS3Client  = new S3Client({
            region: this.awsRegion,
            credentials: accessKeyId ? {
                accessKeyId,
                secretAccessKey: this.configService.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
                sessionToken: this.configService.get('AWS_SESSION_TOKEN'),
            } : undefined,
        });
    }

    async obtenerUrl(contentType:string, tamano:number, carpeta:CarpetaS3):Promise<{uploadUrl:string, publicUrl:string, key:string, contentType:string}>{
        const reglas = REGLAS_CARPETA[carpeta];
        const extension = Object.hasOwn(reglas.tipos, contentType) ? reglas.tipos[contentType] : undefined;
        if(!extension){
            throw new BadRequestException(`Tipo de archivo no permitido para ${carpeta}. Permitidos: ${Object.keys(reglas.tipos).join(', ')}`);
        }
        if(tamano > reglas.maxBytes){
            throw new PayloadTooLargeException(`El archivo supera el máximo de ${reglas.maxBytes / (1024 * 1024)} MB`);
        }

        const key = `${carpeta}/${randomUUID()}.${extension}`

        const command = new PutObjectCommand({
            Bucket: this.awsBucketname,
            Key: key,
            ContentType: contentType,
            ContentLength: tamano,
        });

        const uploadUrl = await getSignedUrl(this.awsS3Client, command, {
            expiresIn: 300,
            signableHeaders: new Set(['content-type', 'content-length']),
        });

        const publicUrl = `${this.urlBase()}${key}`;

        return{uploadUrl, publicUrl, key, contentType}
    }

    // Devuelve la key solo si la URL es de un archivo de esa carpeta en este bucket.
    keyDeUrl(url:string, carpeta:CarpetaS3):string | null{
        const base = this.urlBase();
        if(!url.startsWith(base)) return null;
        const key = url.slice(base.length);
        return new RegExp(`^${carpeta}/[0-9a-f-]{36}\\.[a-z0-9]+$`).test(key) ? key : null;
    }

    private urlBase():string{
        return `https://${this.awsBucketname}.s3.${this.awsRegion}.amazonaws.com/`;
    }

    async eliminarArchivo(key:string):Promise<void>{
        await this.awsS3Client.send(
            new DeleteObjectCommand({
                Bucket: this.awsBucketname,
                Key: key,
            }),
        );
    }
}
