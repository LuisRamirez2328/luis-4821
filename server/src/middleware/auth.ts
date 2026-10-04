/**
 * Middleware de autenticacion: se ejecuta entre la peticion y la ruta, asi que
 * app.use(...) intercepta lo que venga despues.
 *
 *   peticion -> express.json() -> requireAuth -> ruta -> errorHandler
 *
 * No responde ni decide el 401: solo lee el token y deja el usuario en req.
 * Quien rechaza es la ruta, via "exigir", y asi el middleware sirve tanto en
 * modo opcional como obligatorio.
 */
import type { NextFunction, Request, Response } from 'express';
import { usuarioDesdeToken } from '../services/authService.js';
import type { PublicUser } from '@snail/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Presente solo si la peticion lleva un token valido. */
      user?: PublicUser;
      /** Token crudo, necesario para poder cerrar la sesion. */
      authToken?: string;
    }
  }
}

/** Lee la cabecera Authorization y separa el token del prefijo "Bearer ". */
function extraerToken(req: Request): string | null {
  const cabecera = req.headers.authorization;
  if (!cabecera || !cabecera.startsWith('Bearer ')) {
    return null;
  }
  return cabecera.slice('Bearer '.length);
}

/**
 * Adjunta req.user si el token es valido, pero deja pasar la peticion
 * aunque no haya sesion. Util para rutas que cambian de comportamiento.
 */
export function adjuntarUsuario(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = extraerToken(req);
  if (token) {
    const user = usuarioDesdeToken(token);
    if (user) {
      req.user = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      };
      req.authToken = token;
    }
  }
  next();
}

/**
 * Exige sesion activa. Si no hay token valido responde 401 y detiene la
 * cadena. Este es el candado del dashboard: sin el, req.user no existe y las
 * rutas protegidas no pueden obtener ni id ni correo del usuario.
 */
export function exigirSesion(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      status: 'error',
      status_detail: 'No hay una sesion activa',
      code: 'UNAUTHORIZED',
    });
    return;
  }
  next();
}
