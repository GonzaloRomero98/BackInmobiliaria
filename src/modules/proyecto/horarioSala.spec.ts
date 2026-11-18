import { dentroDeHorario, horariosValidos } from './horarioSala';

describe('horario de la sala', () => {
  // Martes 17-11-2026; en noviembre Chile está en UTC-3.
  const horarios = { mar: [['10:00', '18:00']] as [string, string][] };

  it.each([
    ['martes 11:00 de Chile', '2026-11-17T14:00:00Z', true],
    ['martes 10:00, la apertura', '2026-11-17T13:00:00Z', true],
    ['martes 18:00, ya cerró', '2026-11-17T21:00:00Z', false],
    ['martes 09:30, antes de abrir', '2026-11-17T12:30:00Z', false],
    ['miércoles, cerrado', '2026-11-18T14:00:00Z', false],
  ])('%s', (_caso, iso, esperado) => {
    expect(dentroDeHorario(new Date(iso), horarios)).toBe(esperado);
  });

  it.each([
    [null, true],
    [{ lun: [['10:00', '18:00']], sab: [['10:00', '14:00']] }, true],
    [{}, true],
    [{ lunes: [['10:00', '18:00']] }, false],
    [{ lun: [['18:00', '10:00']] }, false],
    [{ lun: [['10:00', '24:00']] }, false],
    [{ lun: [] }, false],
    [{ lun: ['10:00', '18:00'] }, false],
    [[], false],
    ['lun 10 a 18', false],
  ])('horariosValidos(%j) = %s', (valor, esperado) => {
    expect(horariosValidos(valor)).toBe(esperado);
  });
});
