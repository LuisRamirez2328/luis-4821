/**
 * RUTAS DE AUTENTICACION
 * ---------------------------------------------------------------------------
 * Decision de diseno: las rutas NO contienen logica de negocio. Solo:
 *   1. validan la entrada con Zod
 *   2. delegan en authService
 *   3. traducen el resultado a una respuesta HTTP
 *
 *  Asi la logica se puede probar sin levantar el servidor, y las rutas quedan
 * cortas y legibles.
 */
import { Router } from 'express';
import { registerSchema, loginSchema } from '../validation/authSchemas.js';
import { registrar, iniciarSesion, cerrarSesion } from '../services/authService.js';
import { adjuntarUsuario, exigirSesion } from '../middleware/auth.js';

export const authRoutes = Router();

/**
 * POST /api/auth/register
 * Espera: { fullName, email, password, passwordConfirm }
 * Responde 201 con { user, token }
 */
authRoutes.post('/register', async (req, res, next) => {
  try {
    // parse() de Zod devuelve los datos ya validados y tipados. Si algo no
    // cumple el esquema lanza ZodError, que errorHandler convierte en 400.
    const datos = registerSchema.parse(req.body);

    const resultado = await registrar(
      datos.fullName,
      datos.email,
      datos.password,
    );

    res.status(201).json(resultado);
  } catch (error) {
    // next() delega el error al manejador central en vez de responder aqui.
    // Es el patron correcto: mantiene el formato de error unico.
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Espera: { email, password }
 * Responde 200 con { user, token }
 */
authRoutes.post('/login', async (req, res, next) => {
  try {
    const datos = loginSchema.parse(req.body);
    const resultado = await iniciarSesion(datos.email, datos.password);
    res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Exige sesion activa. Responde 204 (sin cuerpo).
 *
 * El token se invalida en el servidor. No es la unica proteccion: el cliente
 * tambien borra su estado. Ambas hacen falta, porque el token podria quedar
 * copiado en otro equipo.
 */
authRoutes.post('/logout', exigirSesion, (req, res) => {
  if (req.authToken) {
    cerrarSesion(req.authToken);
  }
  res.status(204).send();
});

/**
 * GET /api/auth/me
 * Sirve para que el cliente verifique si su token guardado sigue siendo
 * valido despues de recargar la pagina. El enunciado exige mantener la
 * sesion al recargar, y esta ruta es la que lo hace posible sin guardar
 * datos sensibles en el navegador.
 */
authRoutes.get('/me', adjuntarUsuario, exigirSesion, (req, res) => {
  res.status(200).json({ user: req.user });
});
