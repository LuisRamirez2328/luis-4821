/**
 * RUTAS SNAILPAY
 * ---------------------------------------------------------------------------
 * Todas exigen sesion activa: el enunciado pide enviar el identificador y el
 * correo del usuario registrado, y esos datos solo existen si hay sesion.
 *
 * El servicio NO toca el saldo. El saldo vive en LocalStorage, del lado del
 * cliente, y solo se modifica si la respuesta trae status "approved". Esa
 * separacion es intencional: garantiza que ningun fallo pueda alterar el
 * saldo, porque el servidor nunca lo conoce ni lo modifica.
 */
import { Router } from 'express';
import { z } from 'zod';
import { exigirSesion } from '../middleware/auth.js';
import { cobrar, activarCaidaSistema, desactivarCaidaSistema, estadoPasarela, MONTO_MINIMO, MONTO_MAXIMO } from '../services/snailPayService.js';
import { generarDiaSimulado } from '../services/raceSimulator.js';
import { config } from '../config/index.js';

export const snailPayRoutes = Router();

// Sin json() para las rutas que solo activan la caida: no aceptan body.

/**
 * POST /api/snailpay/charge
 *
 * Espera: { cardNumber, expiryDate, cvv, fullName, amount, payer_id, payer_email }
 *
 * NOTA: payer_id y payer_email los envia el cliente, pero el servidor los
 * SOBREESCRIBE con los de la sesion. Motivo: son datos de identidad y no debe
 * confiar en lo que mande el cliente. Si no, cualquiera podria recargar saldo
 * a nombre de otro usuario.
 */
const chargeSchema = z.object({
  cardNumber: z.string().min(1, 'El numero de tarjeta es obligatorio'),
  expiryDate: z.string().min(1, 'La fecha de vencimiento es obligatoria'),
  cvv: z.string().min(1, 'El CVV es obligatorio'),
  fullName: z.string().min(1, 'El nombre completo es obligatorio'),
  // El rango se valida AQUI, en el servidor, y no solo en el formulario.
  // Motivo: la validacion del cliente es cortesia, se puede saltar desde la
  // consola. El servidor es la unica capa en la que se puede confiar.
  amount: z
    .number({ invalid_type_error: 'El monto debe ser un numero' })
    .int('El monto debe ser un numero entero')
    .min(MONTO_MINIMO, `El monto minimo es ${MONTO_MINIMO}`)
    .max(MONTO_MAXIMO, `El monto maximo por recarga es ${MONTO_MAXIMO}`),
});

snailPayRoutes.post('/charge', exigirSesion, (req, res) => {
  const datos = chargeSchema.parse({
    cardNumber: req.body.cardNumber,
    expiryDate: req.body.expiryDate,
    cvv: req.body.cvv,
    fullName: req.body.fullName,
    amount: Number(req.body.amount),
  });

  // La identidad viene de la sesion, nunca del cuerpo de la peticion.
  const respuesta = cobrar({
    ...datos,
    payer_id: req.user!.id,
    payer_email: req.user!.email,
  });

  // Codigo HTTP coherente con el resultado: 200 si se aprobo, 402 si la
  // tarjeta fue rechazada, 503 si la pasarela esta caida.
  const codigo =
    respuesta.status === 'approved' ? 200 : respuesta.status === 'error' ? 503 : 402;

  res.status(codigo).json(respuesta);
});

/**
 * POST /api/snailpay/simulate-outage
 * Activa el escenario de error del sistema. Documentado en el PDF de respuesta.
 */
snailPayRoutes.post('/simulate-outage', exigirSesion, (_req, res) => {
  activarCaidaSistema();
  res.status(200).json({
    status: 'error',
    status_detail:
      'Modo de caida activado. Ninguna recarga sera aprobada, ni siquiera con la tarjeta de prueba valida.',
    code: 'SNP-503',
  });
});

/** POST /api/snailpay/restore — restaura el servicio. */
snailPayRoutes.post('/restore', exigirSesion, (_req, res) => {
  desactivarCaidaSistema();
  res.status(200).json({
    status: 'ok',
    status_detail: 'Servicio restaurado.',
  });
});

/** GET /api/snailpay/status — consulta el estado, util para verificar. */
snailPayRoutes.get('/status', exigirSesion, (_req, res) => {
  res.status(200).json(estadoPasarela());
});

/**
 * RUTAS DE CARRERAS
 *
 * Van en un router aparte porque no guardan relacion con la pasarela: solo
 * entregan los datos simulados del dia para el dashboard.
 */
export const raceRoutes = Router();

/**
 * GET /api/races/today
 * Devuelve el dia simulado. Usa la semilla fija de config, de modo que los
 * datos sean siempre los mismos y por tanto verificables y reproducibles.
 */
raceRoutes.get('/today', (_req, res) => {
  res.status(200).json(generarDiaSimulado(config.defaultRaceSeed));
});
