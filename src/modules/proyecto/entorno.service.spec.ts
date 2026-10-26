import { ServiceUnavailableException } from '@nestjs/common';
import { categoriaDe, construirEntorno, distanciaMetros, EntornoService } from './entorno.service';

describe('EntornoService', () => {
  describe('categoriaDe', () => {
    it.each([
      [{ railway: 'subway_entrance' }, 'transporte'],
      [{ railway: 'station' }, 'transporte'],
      [{ amenity: 'bus_station' }, 'transporte'],
      [{ amenity: 'school' }, 'educacion'],
      [{ amenity: 'kindergarten' }, 'educacion'],
      [{ amenity: 'clinic' }, 'salud'],
      [{ amenity: 'hospital' }, 'salud'],
      [{ shop: 'supermarket' }, 'comercio'],
      [{ leisure: 'park' }, 'areasVerdes'],
      [{ amenity: 'bench' }, null],
      [{ railway: 'rail' }, null],
    ])('%j -> %s', (tags, esperado) => expect(categoriaDe(tags as Record<string, string>)).toBe(esperado));
  });

  it('distanciaMetros: Plaza de Armas a La Moneda ~ 650 m', () => {
    const d = distanciaMetros(-33.4372, -70.6506, -33.4429, -70.6539);
    expect(d).toBeGreaterThan(600);
    expect(d).toBeLessThan(750);
  });

  it('construirEntorno ordena por distancia, resume por categoría y descarta lo irrelevante', () => {
    const entorno = construirEntorno([
      { type: 'node', id: 1, lat: -33.4400, lon: -70.6506, tags: { shop: 'supermarket', name: 'Lejano' } },
      { type: 'node', id: 2, lat: -33.4373, lon: -70.6506, tags: { railway: 'subway_entrance', name: 'Plaza de Armas' } },
      { type: 'way', id: 3, center: { lat: -33.4380, lon: -70.6510 }, tags: { leisure: 'park', name: 'Parque' } },
      { type: 'node', id: 4, lat: -33.4375, lon: -70.6506, tags: { amenity: 'bench' } },
      { type: 'node', id: 2, lat: -33.4373, lon: -70.6506, tags: { railway: 'subway_entrance', name: 'Duplicado' } },
      { type: 'node', id: 5, tags: { amenity: 'school' } },
    ], -33.4372, -70.6506, 1000);

    expect(entorno.lugares.map((l) => l.id)).toEqual(['node/2', 'way/3', 'node/1']);
    expect(entorno.lugares[0]).toMatchObject({ nombre: 'Plaza de Armas', categoria: 'transporte', distancia: 11 });
    expect(entorno.resumen).toEqual({ transporte: 1, educacion: 0, salud: 0, comercio: 1, areasVerdes: 1 });
  });

  describe('calcular', () => {
    const service = new EntornoService();
    const original = global.fetch;
    afterEach(() => { global.fetch = original; });

    it('si un servidor está saturado prueba el siguiente, enviando User-Agent', async () => {
      const fetchMock = jest.fn()
        .mockResolvedValueOnce({ ok: false, status: 504 })
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ ok: true, json: async () => ({ elements: [
          { type: 'node', id: 9, lat: -33.4373, lon: -70.6506, tags: { amenity: 'clinic' } },
        ] }) });
      global.fetch = fetchMock as unknown as typeof fetch;

      const entorno = await service.calcular(-33.4372, -70.6506);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(new Set(fetchMock.mock.calls.map((c) => c[0])).size).toBe(3);
      expect(fetchMock.mock.calls[0][1].headers['User-Agent']).toMatch(/Inmocap/);
      expect(entorno.resumen.salud).toBe(1);
    });

    it('si todos fallan lanza 503', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 }) as unknown as typeof fetch;
      await expect(service.calcular(-33.4, -70.6)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
