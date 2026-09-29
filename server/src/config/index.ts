/**
 * Configuracion centralizada.
 *
 * Decision de diseño: ninguna variable de entorno o valor de infraestructura
 * deberia estar hardcodeado en el codigo. Se leen aqui una sola vez.
 */

export const config = {
  port: Number(process.env.PORT ?? 4000),
  bcryptRounds: 10,
  /** Semilla por defecto del simulador de carreras: datos reproducibles. */
  defaultRaceSeed: 'semilla-2026',
} as const;
