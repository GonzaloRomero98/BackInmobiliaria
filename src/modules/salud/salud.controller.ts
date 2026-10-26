import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import { DataSource } from "typeorm";

@ApiTags('salud')
@SkipThrottle()
@Controller('health')
export class SaludController{
    constructor(private readonly dataSource: DataSource){}

    @Get()
    async estado(){
        try{
            await this.dataSource.query('SELECT 1');
        }catch{
            throw new ServiceUnavailableException({estado:'error', baseDatos:'sin conexión'});
        }
        return {estado:'ok', baseDatos:'ok', fecha:new Date().toISOString()};
    }
}
