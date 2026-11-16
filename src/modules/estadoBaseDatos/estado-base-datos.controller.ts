import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DataSource } from "typeorm";

// Tiene el límite general por IP, porque cada consulta hace un SELECT a la BD.
@ApiTags('estado base de datos')
@Controller('health')
export class EstadoBaseDatosController{
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
