import { ArgumentsHost, Catch, ConflictException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { QueryFailedError } from "typeorm";

// 23505 = unique_violation en PostgreSQL.
const VALOR_DUPLICADO = '23505';

// Los servicios revisan los duplicados antes de guardar y responden 409 con su propio mensaje.
// Si dos guardados pasan esa revisión al mismo tiempo, el índice único de la BD rechaza el segundo:
// aquí ese error se responde como 409 en vez de 500. Cualquier otro error de BD sigue igual que antes.
@Catch(QueryFailedError)
export class DuplicadoFilter extends BaseExceptionFilter{
    catch(error: QueryFailedError, host: ArgumentsHost){
        if((error as {code?:string}).code === VALOR_DUPLICADO){
            return super.catch(new ConflictException('Ya existe un registro con esos datos. Recarga la página e inténtalo de nuevo.'), host);
        }
        return super.catch(error, host);
    }
}
