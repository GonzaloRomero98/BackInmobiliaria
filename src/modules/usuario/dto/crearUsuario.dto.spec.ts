import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CrearUsuarioDto } from './crearUsuario.dto';

async function erroresContrasena(contrasena: string) {
  const dto = plainToInstance(CrearUsuarioDto, { correo: 'a@x.cl', nombre: 'A', rol: 'ADMIN', contrasena });
  return (await validate(dto)).filter((e) => e.property === 'contrasena');
}

describe('CrearUsuarioDto - política de contraseñas', () => {
  it.each(['Corta1A', 'sinmayuscula1', 'SINMINUSCULA1', 'SinNumeroAqui'])('rechaza "%s"', async (c) => {
    expect(await erroresContrasena(c)).toHaveLength(1);
  });

  it('acepta 10+ caracteres con mayúscula, minúscula y número', async () => {
    expect(await erroresContrasena('Inmocap2026')).toHaveLength(0);
  });
});
