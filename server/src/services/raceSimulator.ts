/**
 * SIMULADOR DE CARRERAS
 * ---------------------------------------------------------------------------
 * El enunciado pide datos simulados de 6 caracoles y 6 carreras, y añade un
 * requisito sutil: "deben tener congruencia con las reglas y parametros".
 *
 * DECISIÓN: el generador es determinista. Recibe una semilla y produce
 * SIEMPRE el mismo resultado.
 *
 * Por qué esto importa de verdad (no es，从而使 la vida fácil):
 *   1. Reproducibilidad. El enunciado pide entregar "la información necesaria
 *      para reproducir cada respuesta simulada". Con semilla, cualquiera
 *      regenera exactamente los mismos datos y puede verificarlos.
 *   2. Pruebas estables. Un test que comprueba "la carrera 3 la gano X" no
 *      puede fallar de vez en cuando. Con datos aleatorios, habria que
 *      reintentar y el fallo seria imposible de reproducir.
 *   3. Congruencia demostrable. Con semilla se puede garantizar y probar que
 *      se cumplen las reglas. Con azar, habria que repetir la generacion
 *      hasta obtener un resultado valido, lo cual es fragil.
 *
 * El algoritmo es un PRNG propio (mulberry32): diminuto, rapido y suficiente
 * para datos de demostracion. No se usa Math.random() porque no es
 * determinista y no se puede replicar a partir de una semilla.
 */
import type { Race, SimulatedDay, Snail } from '@snail/shared';

export const SNAILS: Snail[] = [
  { id: 'turbo', name: 'Turbo', color: '#6366F1' },
  { id: 'flash', name: 'Flash', color: '#EC4899' },
  { id: 'shell', name: 'Shell', color: '#F59E0B' },
  { id: 'ninja', name: 'Ninja', color: '#10B981' },
  { id: 'pixel', name: 'Pixel', color: '#3B82F6' },
  { id: 'cometa', name: 'Cometa', color: '#EF4444' },
];

export const CANTIDAD_CARRERAS = 6;

/**
 * Genera un numero pseudoaleatorio en [0, 1) a partir de un estado entero.
 * Es "mulberry32": rapido, sin dependencias y suficientemente uniforme para
 * una simulacion.
 */
function crearGenerador(semilla: number): () => number {
  let estado = semilla >>> 0;
  return function siguiente(): number {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convierte cualquier texto en un entero de 32 bits, para usar de semilla. */
function semillaANumero(semilla: string): number {
  let hash = 2166136261;
  for (let i = 0; i < semilla.length; i += 1) {
    hash ^= semilla.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Genera el dia simulado completo.
 *
 * Reglas garantizadas por construccion:
 *   - exactamente 6 caracoles (SNAILS)
 *   - exactamente 6 carreras (CANTIDAD_CARRERAS)
 *   - cada carrera tiene exactamente 1 ganador
 *   - el ganador siempre pertenece a la lista de caracoles
 *   - los identificadores de carrera son únicos
 */
export function generarDiaSimulado(semilla: string): SimulatedDay {
  const generar = crearGenerador(semillaANumero(semilla));

  const carreras: Race[] = [];

  for (let numero = 1; numero <= CANTIDAD_CARRERAS; numero += 1) {
    // Indice aleatorio dentro del rango de caracoles.
    const indiceGanador = Math.floor(generar() * SNAILS.length);
    // noUncheckedIndexedAccess obliga a comprobar: si el array estaria vacio,
    // SNAILS[0] seria undefined. El fallback hace el codigo seguro por tipo.
    const ganador = SNAILS[indiceGanador] ?? SNAILS[0]!;

    carreras.push({
      id: `race-${semilla}-${numero}`,
      number: numero,
      winnerSnailId: ganador.id,
      seed: `${semilla}:${numero}`,
    });
  }

  return {
    date: '2026-01-15',
    seed: semilla,
    races: carreras,
    snails: SNAILS,
  };
}

/**
 * Cuenta las victorias por caracol a partir de las carreras.
 *
 * Se calcula aqui y no en el cliente para que la grafica de barras y las
 * pruebas usen exactamente la misma fuente. Si cada lado lo calculara por su
 * cuenta, podrian discrepar.
 */
export function contarVictorias(carreras: Race[]): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const caracol of SNAILS) {
    conteo[caracol.id] = 0;
  }
  for (const carrera of carreras) {
    conteo[carrera.winnerSnailId] = (conteo[carrera.winnerSnailId] ?? 0) + 1;
  }
  return conteo;
}
