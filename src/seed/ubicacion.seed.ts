import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { Repository } from "typeorm";
import { Region } from "../modules/ubicacion/entities/region.entity";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Ciudad } from "../modules/ubicacion/entities/ciudad.entity";

const data_regiones_ciudades:Record<string,string[]> = {
    'Arica y Parinacota': ['Arica'],
    'Tarapacá': ['Iquique', 'Alto Hospicio'],
    'Antofagasta': ['Antofagasta', 'Calama'],
    'Atacama': ['Copiapó', 'Vallenar'],
    'Coquimbo': ['La Serena', 'Coquimbo', 'Ovalle'],
    'Valparaíso': ['Valparaíso', 'Viña del Mar', 'Quilpué', 'Villa Alemana'],
    'Metropolitana de Santiago': ['Santiago', 'Las Condes', 'Providencia', 'Ñuñoa', 'Maipú', 'La Florida', 'Puente Alto'],
    "O'Higgins": ['Rancagua', 'San Fernando'],
    'Maule': ['Talca', 'Curicó'],
    'Ñuble': ['Chillán'],
    'Biobío': ['Concepción', 'Talcahuano', 'Los Ángeles'],
    'La Araucanía': ['Temuco', 'Pucón'],
    'Los Ríos': ['Valdivia'],
    'Los Lagos': ['Puerto Montt', 'Osorno'],
    'Aysén': ['Coyhaique'],
    'Magallanes': ['Punta Arenas'],
};

async function boostrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const regionRepositorio = app.get<Repository<Region>>(getRepositoryToken(Region));
    const ciudadRepositorio = app.get<Repository<Ciudad>>(getRepositoryToken(Ciudad));

    for(const [region_nombre, ciudades] of Object.entries(data_regiones_ciudades)){
        let region = await regionRepositorio.findOne({where:{nombre:region_nombre}});
        if(!region){
            region = await regionRepositorio.save(regionRepositorio.create({nombre:region_nombre}));
            console.log('region:', region);
        }

        for(const nombre of ciudades){
            const existeCiudad = await ciudadRepositorio.findOne({where:{nombre, region:{id:region.id}}});
            if(!existeCiudad){
                await ciudadRepositorio.save(ciudadRepositorio.create({ nombre, region }));
            }
        }
    }
    await app.close();
}
boostrap();