/**
 * Middleware para rutas no encontradas.
 *
 * Responsabilidad: si ninguna ruta respondio, convertir el 404 en un error
 * con el mismo formato que usa errorHandler.
 */
import type { NextFunction, Request, Response } from 'express';

export function notFoundHandler(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(new Error('Recurso no encontrado'));
}
