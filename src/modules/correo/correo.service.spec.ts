import { ConfigService } from '@nestjs/config';
import { CorreoService, MAX_CORREOS_WEB_POR_DIA } from './correo.service';

describe('CorreoService', () => {
  it('sin credenciales no intenta enviar', async () => {
    const servicio = new CorreoService(new ConfigService({}));
    await expect(servicio.enviar('a@b.cl', 'Asunto', 'Texto')).resolves.toBeUndefined();
  });

  it('si Gmail falla no lanza el error', async () => {
    const servicio = new CorreoService(new ConfigService({ SMTP_USUARIO: 'x@gmail.com', SMTP_CLAVE: 'clave' }));
    const sendMail = jest.fn().mockRejectedValue(new Error('sin conexión'));
    Object.assign(servicio, { transporte: { sendMail } });
    await expect(servicio.enviar('a@b.cl', 'Asunto', 'Texto')).resolves.toBeUndefined();
    expect(sendMail).toHaveBeenCalledWith({ from: 'Inmocap <x@gmail.com>', to: 'a@b.cl', subject: 'Asunto', text: 'Texto' });
  });

  describe('tope diario del formulario web', () => {
    let servicio: CorreoService;
    let sendMail: jest.Mock;
    let ahora: number;

    beforeEach(() => {
      // 12:00 en Chile del 18-11-2026.
      ahora = Date.parse('2026-11-18T15:00:00Z');
      jest.spyOn(Date, 'now').mockImplementation(() => ahora);
      servicio = new CorreoService(new ConfigService({ SMTP_USUARIO: 'x@gmail.com', SMTP_CLAVE: 'clave' }));
      sendMail = jest.fn().mockResolvedValue(undefined);
      Object.assign(servicio, { transporte: { sendMail } });
    });
    afterEach(() => jest.restoreAllMocks());

    const enviarWeb = async (veces: number) => {
      for (let i = 0; i < veces; i++) await servicio.enviarDesdeWeb('a@b.cl', 'Asunto', 'Texto');
    };

    it('pasado el tope no envía más ese día, y al día siguiente (hora de Chile) vuelve a enviar', async () => {
      await enviarWeb(MAX_CORREOS_WEB_POR_DIA + 5);
      expect(sendMail).toHaveBeenCalledTimes(MAX_CORREOS_WEB_POR_DIA);

      // 23:59 en Chile: sigue siendo el mismo día aunque en UTC ya sea el 19.
      ahora = Date.parse('2026-11-19T02:59:00Z');
      await enviarWeb(1);
      expect(sendMail).toHaveBeenCalledTimes(MAX_CORREOS_WEB_POR_DIA);

      ahora = Date.parse('2026-11-19T03:01:00Z');
      await enviarWeb(1);
      expect(sendMail).toHaveBeenCalledTimes(MAX_CORREOS_WEB_POR_DIA + 1);
    });

    it('el tope no afecta a los correos del panel', async () => {
      await enviarWeb(MAX_CORREOS_WEB_POR_DIA + 1);
      sendMail.mockClear();
      await servicio.enviar('a@b.cl', 'Visita confirmada', 'Texto');
      expect(sendMail).toHaveBeenCalledTimes(1);
    });
  });
});
