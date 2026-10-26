import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Auditoria } from "./entities/auditoria.entity";

export type RegistroAuditoria = Partial<Omit<Auditoria, 'id' | 'fecha'>> & Pick<Auditoria, 'accion' | 'exito'>;

@Injectable()
export class AuditoriaService{
    private readonly logger = new Logger('Auditoria');

    constructor(
        @InjectRepository(Auditoria)
        private readonly auditoriaRepository: Repository<Auditoria>
    ){}

    // Nunca lanza: un fallo al auditar no debe tumbar la petición, pero queda en el log.
    async registrar(registro: RegistroAuditoria): Promise<void>{
        this.logger.log(`${registro.accion} exito=${registro.exito} usuario=${registro.correo ?? '-'} ip=${registro.ip ?? '-'}`);
        try{
            await this.auditoriaRepository.save(this.auditoriaRepository.create(registro));
        }catch(error){
            this.logger.error(`No se pudo guardar el registro de auditoría: ${(error as Error).message}`);
        }
    }

    async listar(pagina: number, limite: number){
        const [registros, total] = await this.auditoriaRepository.findAndCount({
            order:{fecha:'DESC'},
            skip:(pagina - 1) * limite,
            take:limite,
        });
        return {registros, total, pagina, limite};
    }
}
