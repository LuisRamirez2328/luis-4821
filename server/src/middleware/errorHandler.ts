/**
 * MANEJADOR CENTRALIZADO DE ERRORES
 * ---------------------------------------------------------------------------
 * En Express, un error lanzado dentro de una ruta NO se responde solo: viaja
 * hacia abajo por la cadena de middlewares hasta que alguien lo atrape.
 *
 * Si cada ruta hiciera su propio try/catch, el formato de error variaria
 * segun quien escribio la ruta. Centralizando, TODA la API responde con la
 * misma estructura. Eso es lo que evalua el enunciado bajo "manejo de estados
 * y errores".
 *
 * Por eso va SIEMPRE al final: si se registra antes, las rutas que se agregan
 * despues quedarian fuera de su alcance.
 */
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/** Error de dominio: un fallo previsto de la aplicacion, no un bug. */
export class ErrorAplicacion extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ErrorAplicacion';
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // 1. Error de validacion de Zod: son errores del cliente (400), no del
  //    servidor. Se devuelve el detalle por campo para que el formulario
  //    pueda marcar el input equivocado.
  if (err instanceof ZodError) {
    const detalles: Record<string, string> = {};
    for (const issue of err.issues) {
      detalles[String(issue.path[0] ?? 'formulario')] = issue.message;
    }
    res.status(400).json({
      status: 'error',
      status_detail: 'Los datos enviados no son validos',
      code: 'VALIDATION_ERROR',
      errors: detalles,
    });
    return;
  }

  // 2. Error previsto de la aplicacion.
  if (err instanceof ErrorAplicacion) {
    res.status(err.statusCode).json({
      status: 'error',
      status_detail: err.message,
      code: err.code,
    });
    return;
  }

  // 3. Cualquier otra cosa es un fallo no previsto. Se registra completo en
  //    el servidor y se responde de forma generica.
  //
  //    Esto es una decision de seguridad: nunca se devuelve el mensaje real
  //    de un error inesperado al cliente, porque puede contener rutas de
  //    archivos, consultas SQL u otra informacion interna.
  console.error('Error no controlado:', err);
  res.status(500).json({
    status: 'error',
    status_detail: 'Ocurrio un error interno. Intenta de nuevo.',
    code: 'INTERNAL_ERROR',
  });
}
