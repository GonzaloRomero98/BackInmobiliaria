export function normalizarRut(valor: string): string {
    const limpio = valor.replace(/[.\s-]/g, '').toUpperCase();
    return limpio.length < 2 ? limpio : `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

// Valida el dígito verificador con módulo 11.
export function rutValido(rut: string): boolean {
    const partes = /^(\d{7,8})-([\dK])$/.exec(rut);
    if (!partes) return false;
    let suma = 0;
    let factor = 2;
    for (const digito of [...partes[1]].reverse()) {
        suma += Number(digito) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const resto = 11 - (suma % 11);
    const dv = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
    return dv === partes[2];
}
