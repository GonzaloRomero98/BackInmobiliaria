import { Column, Entity, Index, PrimaryColumn } from "typeorm";

// Tokens cerrados con "Cerrar sesión" antes de vencer (ISO 27001 A.8.5). Solo se cierra ese dispositivo.
// La fila se borra cuando el token habría vencido igual, así la tabla queda siempre pequeña.
@Entity('sesion_cerrada')
export class SesionCerrada {
    @PrimaryColumn('uuid')
    jti: string;

    @Index('IDX_sesion_cerrada_vence_en')
    @Column({ name: 'vence_en', type: 'timestamptz' })
    venceEn: Date;
}
