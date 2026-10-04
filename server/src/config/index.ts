/**
 * Configuracion centralizada: los valores de infraestructura se leen aqui una
 * sola vez en vez de estar hardcodeados en el codigo.
 */

export const config = {
  port: Number(process.env.PORT ?? 4000),
  bcryptRounds: 10,
  /** Semilla por defecto del simulador de carreras: datos reproducibles. */
  defaultRaceSeed: 'semilla-2026',
} as const;
