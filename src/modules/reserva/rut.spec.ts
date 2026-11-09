import { normalizarRut, rutValido } from './rut';

describe('RUT', () => {
  it.each([
    ['12.345.678-5', '12345678-5'],
    ['12345678-5', '12345678-5'],
    ['123456785', '12345678-5'],
    ['5.126.665-k', '5126665-K'],
    ['  7.654.321-6 ', '7654321-6'],
  ])('normalizarRut(%s) = %s', (entrada, esperado) => {
    expect(normalizarRut(entrada)).toBe(esperado);
  });

  it.each(['12345678-5', '5126665-K', '7654321-6'])('%s es válido', (r) => {
    expect(rutValido(r)).toBe(true);
  });

  it.each(['12345678-4', '5126663-1', 'abc', '', '1-9'])('%s es inválido', (r) => {
    expect(rutValido(r)).toBe(false);
  });
});
