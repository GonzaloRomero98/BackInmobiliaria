import { Transform } from "class-transformer";
import { IsOptional, IsString, IsUUID, MaxLength, ValidateBy } from "class-validator";
import { normalizarRut, rutValido } from "../rut";

export class CrearReservaDto{
    @IsUUID()
    id_solicitud:string;

    @Transform(({value}) => typeof value === 'string' ? normalizarRut(value) : value)
    @ValidateBy({
        name:'rutValido',
        validator:{
            validate:(valor) => typeof valor === 'string' && rutValido(valor),
            defaultMessage:() => 'RUT inválido',
        },
    })
    rut:string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    lote?:string;
}
