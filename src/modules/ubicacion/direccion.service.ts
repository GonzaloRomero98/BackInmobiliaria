import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
// Nominatim pide como máximo una consulta por segundo.
const ESPERA_MINIMA_MS = 1000;
const TIMEOUT_MS = 8000;

// Se usa la calle y el número, no el nombre del lugar: la ciudad y la región ya se guardan aparte.
export function armarDireccion(address?:Record<string, string>):string | null{
    const calle = address?.road ?? address?.pedestrian ?? address?.path;
    if(!calle) return null;
    return [calle, address?.house_number].filter(Boolean).join(' ').slice(0, 200);
}

@Injectable()
export class DireccionService{
    private readonly logger = new Logger('Direccion');
    private siguienteTurno = 0;

    // Mejora pendiente: el turno vive en memoria, así que con más de una instancia de la API el límite sería por instancia.
    private async esperarTurno():Promise<void>{
        const ahora = Date.now();
        const turno = Math.max(ahora, this.siguienteTurno);
        this.siguienteTurno = turno + ESPERA_MINIMA_MS;
        if(turno > ahora){
            await new Promise((resolver) => setTimeout(resolver, turno - ahora));
        }
    }

    async buscar(latitud:number, longitud:number):Promise<string | null>{
        await this.esperarTurno();
        try{
            const parametros = new URLSearchParams({
                format:'jsonv2', lat:String(latitud), lon:String(longitud), zoom:'18', addressdetails:'1', 'accept-language':'es',
            });
            const respuesta = await fetch(`${NOMINATIM}?${parametros}`, {
                headers:{'Accept':'application/json', 'User-Agent':'Inmocap/1.0 (portal inmobiliario)'},
                signal:AbortSignal.timeout(TIMEOUT_MS),
            });
            if(!respuesta.ok){
                throw new Error(`respondió ${respuesta.status}`);
            }
            const {address} = await respuesta.json() as {address?:Record<string, string>};
            return armarDireccion(address);
        }catch(error){
            this.logger.warn(`Nominatim no respondió: ${(error as Error).message}`);
            throw new ServiceUnavailableException('No se pudo obtener la dirección, escríbela a mano');
        }
    }
}
