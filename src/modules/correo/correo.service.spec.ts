import { ConfigService } from '@nestjs/config';
import { CorreoService } from './correo.service';

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
});
