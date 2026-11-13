import type { Request } from 'express';
import { esLecturaSsr } from './limite-ssr';

const peticion = (method: string, clave?: string) =>
  ({ method, headers: clave === undefined ? {} : { 'x-ssr-clave': clave } }) as unknown as Request;

describe('esLecturaSsr', () => {
  it('libera del límite los GET con la clave correcta', () => {
    expect(esLecturaSsr(peticion('GET', 'secreta'), 'secreta')).toBe(true);
  });

  it('no libera con otra clave, sin clave o con otro largo', () => {
    expect(esLecturaSsr(peticion('GET', 'secretx'), 'secreta')).toBe(false);
    expect(esLecturaSsr(peticion('GET'), 'secreta')).toBe(false);
    expect(esLecturaSsr(peticion('GET', 'secreta-larga'), 'secreta')).toBe(false);
  });

  it('nunca libera POST/PATCH/DELETE (login y formularios conservan su límite)', () => {
    for (const metodo of ['POST', 'PATCH', 'DELETE']) {
      expect(esLecturaSsr(peticion(metodo, 'secreta'), 'secreta')).toBe(false);
    }
  });

  it('sin SSR_CLAVE configurada no libera nada (ni con la cabecera vacía)', () => {
    expect(esLecturaSsr(peticion('GET', ''), undefined)).toBe(false);
    expect(esLecturaSsr(peticion('GET', ''), '')).toBe(false);
  });
});
