/**
 * PRUEBAS DEL SIMULADOR DE CARRERAS
 * ---------------------------------------------------------------------------
 * Estas pruebas son la evidencia de la "congruencia" que exige el enunciado.
 * Verifican tres cosas:
 *
 *   1. Las reglas basicas: 6 caracoles, 6 carreras, 1 ganador por carrera,
 *      y que ese ganador siempre sea un caracol valido.
 *   2. El determinismo: la misma semilla produce exactamente los mismos datos.
 *      Sin esto, no seria posible "reproducir cada respuesta simulada".
 *   3. La variedad: semillas distintas producen resultados distintos, para
 *      no entregar siempre la misma tabla.
 */
import { describe, it, expect } from 'vitest';
import { generarDiaSimulado, contarVictorias, SNAILS, CANTIDAD_CARRERAS } from '../services/raceSimulator.js';

describe('generarDiaSimulado', () => {
  it('genera exactamente 6 caracoles y 6 carreras', () => {
    const dia = generarDiaSimulado('semilla-2026');

    expect(dia.snails).toHaveLength(6);
    expect(dia.races).toHaveLength(CANTIDAD_CARRERAS);
    expect(CANTIDAD_CARRERAS).toBe(6);
  });

  it('cada carrera tiene exactamente un ganador, y es un caracol valido', () => {
    const dia = generarDiaSimulado('semilla-2026');
    const idsValidos = SNAILS.map((s) => s.id);

    for (const carrera of dia.races) {
      expect(carrera.winnerSnailId).toBeTruthy();
      expect(idsValidos).toContain(carrera.winnerSnailId);
    }
  });

  it('los identificadores de carrera son unicos', () => {
    const dia = generarDiaSimulado('semilla-2026');
    const ids = dia.races.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('es determinista: la misma semilla da el mismo resultado', () => {
    const a = generarDiaSimulado('semilla-2026');
    const b = generarDiaSimulado('semilla-2026');

    // Esta es la garantia que hace reproducibles los datos entregados.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('semillas distintas producen resultados distintos', () => {
    const a = generarDiaSimulado('semilla-2026');
    const b = generarDiaSimulado('otra-semilla');
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe('contarVictorias', () => {
  it('el total de victorias coincide con el numero de carreras', () => {
    const dia = generarDiaSimulado('semilla-2026');
    const conteo = contarVictorias(dia.races);

    const total = Object.values(conteo).reduce((acc, n) => acc + n, 0);
    // Coherencia: cada carrera aporta exactamente una victoria. Si esto
    // fallara, el grafico de barras no cuadraria con las carreras.
    expect(total).toBe(CANTIDAD_CARRERAS);
  });

  it('incluye a los 6 caracoles, incluso los que no ganaron ninguna vez', () => {
    const conteo = contarVictorias(generarDiaSimulado('semilla-2026').races);
    expect(Object.keys(conteo)).toHaveLength(6);
  });
});
