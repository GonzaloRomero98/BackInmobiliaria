import { ServiceUnavailableException } from '@nestjs/common';
import { armarDireccion, DireccionService } from './direccion.service';

describe('DireccionService', () => {
  describe('armarDireccion', () => {
    it('usa calle y número, sin el nombre del lugar', () => {
      expect(armarDireccion({ tourism: 'Museo Histórico Nacional', house_number: '951', road: 'Plaza de Armas', city: 'Santiago' }))
        .toBe('Plaza de Armas 951');
    });

    it('sin número deja solo la calle', () => {
      expect(armarDireccion({ road: '1 Sur' })).toBe('1 Sur');
    });

    it('usa la vía peatonal si no hay calle', () => {
      expect(armarDireccion({ pedestrian: 'Paseo Ahumada', house_number: '12' })).toBe('Paseo Ahumada 12');
    });

    it('sin calle devuelve null', () => {
      expect(armarDireccion({ city: 'Talca' })).toBeNull();
      expect(armarDireccion(undefined)).toBeNull();
    });

    it('no pasa de 200 caracteres', () => {
      expect(armarDireccion({ road: 'x'.repeat(300) })).toHaveLength(200);
    });
  });

  describe('buscar', () => {
    const original = global.fetch;
    afterEach(() => { global.fetch = original; });

    it('consulta Nominatim con las coordenadas y un User-Agent', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ address: { road: 'Plaza de Armas', house_number: '951' } }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(new DireccionService().buscar(-33.4372, -70.6506)).resolves.toBe('Plaza de Armas 951');

      const [url, opciones] = fetchMock.mock.calls[0];
      expect(url).toContain('lat=-33.4372');
      expect(url).toContain('lon=-70.6506');
      expect(opciones.headers['User-Agent']).toMatch(/Inmocap/);
    });

    it('si Nominatim responde con error lanza 503', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;
      await expect(new DireccionService().buscar(-33, -70)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('si Nominatim no responde a tiempo lanza 503', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as unknown as typeof fetch;
      await expect(new DireccionService().buscar(-33, -70)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('la segunda consulta seguida espera para no pasar de una por segundo', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ address: { road: 'A' } }) }) as unknown as typeof fetch;
      const servicio = new DireccionService();
      const inicio = Date.now();
      await servicio.buscar(-33, -70);
      await servicio.buscar(-33, -70);
      expect(Date.now() - inicio).toBeGreaterThanOrEqual(950);
    });
  });
});
