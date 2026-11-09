import { calcularEstado } from './modelo-casa.enum';

describe('calcularEstado', () => {
  it.each([
    [5, 2, 1, 'DISPONIBLE'],
    [3, 1, 2, 'RESERVADO'],
    [3, 0, 3, 'VENDIDO'],
  ])('calcularEstado(%i, %i, %i) = %s', (u, r, v, esperado) => {
    expect(calcularEstado(u, r, v)).toBe(esperado);
  });
});
