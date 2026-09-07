import { Injectable } from "@nestjs/common";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
    private readonly awsS3Client: S3Client;
    private readonly awsBucketname: string;

    constructor(private readonly configService: ConfigService) {
        this.awsBucketname = this.configService.getOrThrow<string>('AWS_S3_BUCKET');
        
        this.awsS3Client  = new S3Client({
            region: this.configService.getOrThrow<string>('AWS_REGION'),
            credentials: {
                accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
                secretAccessKey: this.configService.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
                sessionToken: this.configService.get('AWS_SESSION_TOKEN'),
            }
        });
    }

    async obtenerUrl(archivo:string, contentType:string):Promise<{uploadUrl:string, publicUrl:string, key:string}>{
        const extension = archivo.split('.').pop();
        const key = `models/${uuidv4()}.${extension}`

        const command = new PutObjectCommand({
            Bucket: this.awsBucketname,
            Key: key,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(this.awsS3Client, command, {
            expiresIn: 300,
        });

        const publicUrl = `https://${this.awsBucketname}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;

        return{uploadUrl, publicUrl, key}
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
