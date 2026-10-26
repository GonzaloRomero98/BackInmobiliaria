import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

export type CategoriaEntorno = 'transporte' | 'educacion' | 'salud' | 'comercio' | 'areasVerdes';

export interface LugarCercano {
    id: string;
    nombre: string | null;
    categoria: CategoriaEntorno;
    latitud: number;
    longitud: number;
    distancia: number; // metros
}

export interface Entorno {
    radio: number;
    lugares: LugarCercano[];
    resumen: Record<CategoriaEntorno, number>;
}

const CATEGORIAS: CategoriaEntorno[] = ['transporte', 'educacion', 'salud', 'comercio', 'areasVerdes'];

// Servidores públicos de la API Overpass (OpenStreetMap); se prueban en orden porque suelen saturarse
const SERVIDORES_OVERPASS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
];
const MAX_LUGARES = 80;

interface ElementoOverpass {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

export function categoriaDe(tags: Record<string, string>): CategoriaEntorno | null {
    if (/^(station|subway_entrance|halt)$/.test(tags.railway ?? '') || tags.amenity === 'bus_station') return 'transporte';
    if (/^(school|kindergarten|college|university)$/.test(tags.amenity ?? '')) return 'educacion';
    if (/^(hospital|clinic|doctors)$/.test(tags.amenity ?? '')) return 'salud';
    if (/^(supermarket|mall)$/.test(tags.shop ?? '')) return 'comercio';
    if (tags.leisure === 'park') return 'areasVerdes';
    return null;
}

export function distanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const rad = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * rad / 2) ** 2
        + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function construirEntorno(elementos: ElementoOverpass[], latitud: number, longitud: number, radio: number): Entorno {
    const vistos = new Set<string>();
    const lugares: LugarCercano[] = [];
    for (const el of elementos) {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        const categoria = el.tags ? categoriaDe(el.tags) : null;
        const id = `${el.type}/${el.id}`;
        if (lat === undefined || lon === undefined || !categoria || vistos.has(id)) continue;
        vistos.add(id);
        lugares.push({
            id,
            nombre: el.tags?.name ?? null,
            categoria,
            latitud: lat,
            longitud: lon,
            distancia: Math.round(distanciaMetros(latitud, longitud, lat, lon)),
        });
    }
    lugares.sort((a, b) => a.distancia - b.distancia);

    const resumen = Object.fromEntries(
        CATEGORIAS.map((c) => [c, lugares.filter((l) => l.categoria === c).length]),
    ) as Record<CategoriaEntorno, number>;

    return { radio, lugares: lugares.slice(0, MAX_LUGARES), resumen };
}

@Injectable()
export class EntornoService{
    private readonly logger = new Logger('Entorno');

    async calcular(latitud: number, longitud: number, radio = 1000): Promise<Entorno>{
        const cerca = `(around:${radio},${latitud},${longitud})`;
        const consulta = `[out:json][timeout:15][maxsize:33554432];
(
  nwr${cerca}["railway"~"^(station|subway_entrance|halt)$"];
  nwr${cerca}["amenity"="bus_station"];
  nwr${cerca}["amenity"~"^(school|kindergarten|college|university|hospital|clinic|doctors)$"];
  nwr${cerca}["shop"~"^(supermarket|mall)$"];
  nwr${cerca}["leisure"="park"]["name"];
);
out center tags 400;`;

        for (const servidor of SERVIDORES_OVERPASS) {
            try {
                const respuesta = await fetch(servidor, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json',
                        // Overpass rechaza (406) peticiones sin un User-Agent identificable
                        'User-Agent': 'Inmocap/1.0 (portal inmobiliario)',
                    },
                    body: `data=${encodeURIComponent(consulta)}`,
                    signal: AbortSignal.timeout(20_000),
                });
                if (!respuesta.ok) {
                    this.logger.warn(`${servidor} respondió ${respuesta.status}`);
                    continue;
                }
                const { elements = [] } = await respuesta.json() as { elements?: ElementoOverpass[] };
                return construirEntorno(elements, latitud, longitud, radio);
            } catch (error) {
                this.logger.warn(`${servidor} no respondió: ${(error as Error).message}`);
            }
        }
        throw new ServiceUnavailableException('OpenStreetMap no está disponible en este momento, intenta de nuevo en unos minutos');
    }
}
