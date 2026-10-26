import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';

describe('S3Service', () => {
  const config = new ConfigService({
    AWS_S3_BUCKET: 'bucket-test',
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'AKIATEST',
    AWS_SECRET_ACCESS_KEY: 'secret',
  });
  const service = new S3Service(config);

  it('genera una key única con la extensión del tipo permitido (no la del nombre)', async () => {
    const res = await service.obtenerUrl('image/jpeg', 1000, 'proyectos');

    expect(res.key).toMatch(/^proyectos\/[0-9a-f-]{36}\.jpg$/);
    expect(res.publicUrl).toBe(`https://bucket-test.s3.us-east-1.amazonaws.com/${res.key}`);
    expect(res.uploadUrl).toContain(`bucket-test.s3.us-east-1.amazonaws.com/${res.key}`);
    expect(res.uploadUrl).toContain('X-Amz-Expires=300');
    expect(res.contentType).toBe('image/jpeg');
  });

  it('firma content-type y content-length: S3 rechaza otro tipo o tamaño', async () => {
    const res = await service.obtenerUrl('model/gltf-binary', 2048, 'modelos3D');
    const firmados = new URL(res.uploadUrl).searchParams.get('X-Amz-SignedHeaders');
    expect(firmados?.split(';')).toEqual(expect.arrayContaining(['content-length', 'content-type', 'host']));
    expect(res.key).toMatch(/\.glb$/);
  });

  it('dos llamadas generan keys distintas', async () => {
    const a = await service.obtenerUrl('image/png', 10, 'modelosImagenes');
    const b = await service.obtenerUrl('image/png', 10, 'modelosImagenes');
    expect(a.key).not.toBe(b.key);
  });

  it.each([
    ['text/html', 'proyectos'],
    ['image/svg+xml', 'proyectos'],
    ['image/jpeg', 'modelos3D'],
    ['model/gltf-binary', 'modelosImagenes'],
    ['constructor', 'proyectos'],
  ] as const)('rechaza %s en %s', async (tipo, carpeta) => {
    await expect(service.obtenerUrl(tipo, 10, carpeta)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza archivos sobre el máximo de la carpeta', async () => {
    await expect(service.obtenerUrl('image/jpeg', 10 * 1024 * 1024 + 1, 'proyectos'))
      .rejects.toBeInstanceOf(PayloadTooLargeException);
    await expect(service.obtenerUrl('model/gltf-binary', 50 * 1024 * 1024, 'modelos3D')).resolves.toBeDefined();
  });

  it('sin claves de acceso usa la cadena de credenciales de AWS (rol IAM)', () => {
    expect(() => new S3Service(new ConfigService({ AWS_S3_BUCKET: 'b', AWS_REGION: 'us-east-1' }))).not.toThrow();
  });

  it('falla al iniciar si falta bucket o región', () => {
    expect(() => new S3Service(new ConfigService({ AWS_REGION: 'us-east-1' }))).toThrow();
    expect(() => new S3Service(new ConfigService({ AWS_S3_BUCKET: 'b' }))).toThrow();
  });
});
