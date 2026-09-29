/**
 * CLIENTE HTTP
 * ---------------------------------------------------------------------------
 * Un unico punto de salida hacia la API. Concentrar las llamadas aqui tiene
 * tres beneficios:
 *   1. La URL base y el token se escriben una sola vez.
 *   2. Los errores del servidor llegan ya como objetos, no como texto.
 *   3. Es el unico lugar que hay que tocar si la API cambia de direccion.
 *
 * NOTA DE SEGURIDAD: el token se envia en la cabecera Authorization, NUNCA en
 * la URL. Un token en la URL queda en el historial del navegador y en los
 * logs del servidor.
 */
import { leerSesion } from './storage';

const BASE_URL = 'http://localhost:4000/api';

/** Error normalizado que el frontend puede mostrar sin parsear textos. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly errors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function obtenerToken(): string | null {
  return leerSesion()?.token ?? null;
}

/**
 * Wrapper de fetch con manejo de errores y token automatico.
 *
 * @param method  verbo HTTP
 * @param path    ruta relativa a /api, por ejemplo '/auth/login'
 * @param body    objeto a enviar; se convierte a JSON automaticamente
 */
async function peticion<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = obtenerToken();

  const cabeceras: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    cabeceras.Authorization = `Bearer ${token}`;
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: cabeceras,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch solo rechaza cuando no hubo respuesta (servidor caido, sin red).
    throw new ApiError('No se pudo conectar con el servidor.', 0, 'NETWORK_ERROR');
  }

  // 204 = exito sin contenido (logout). Intentar leer JSON daria error.
  if (respuesta.status === 204) {
    return undefined as T;
  }

  const datos = (await respuesta.json().catch(() => null)) as Record<string, unknown> | null;

  if (!respuesta.ok) {
    throw new ApiError(
      (datos?.status_detail as string) ?? 'Ocurrio un error inesperado.',
      respuesta.status,
      (datos?.code as string) ?? 'UNKNOWN',
      datos?.errors as Record<string, string> | undefined,
    );
  }

  return datos as T;
}

// --- Autenticacion ---------------------------------------------------------

export interface RespuestaAuth {
  user: { id: string; fullName: string; email: string };
  token: string;
}

export const api = {
  registrar: (fullName: string, email: string, password: string, passwordConfirm: string) =>
    peticion<RespuestaAuth>('POST', '/auth/register', {
      fullName,
      email,
      password,
      passwordConfirm,
    }),

  iniciarSesion: (email: string, password: string) =>
    peticion<RespuestaAuth>('POST', '/auth/login', { email, password }),

  cerrarSesion: () => peticion<void>('POST', '/auth/logout'),

  /** Verifica si el token guardado sigue siendo valido (tras recargar). */
  verificarSesion: () =>
    peticion<{ user: RespuestaAuth['user'] }>('GET', '/auth/me'),

  // --- SnailPay -----------------------------------------------------------

  /**
   * Cobra un monto. Devuelve la respuesta TAL CUAL la envia SnailPay, sin
   * interpretar. Quien decide si suma saldo es la pagina, no esta funcion:
   * asi queda explicito en un solo lugar que solo un "approved" suma.
   */
  cobrar: (datos: {
    cardNumber: string;
    expiryDate: string;
    cvv: string;
    fullName: string;
    amount: number;
  }) => peticion<import('@snail/shared').SnailPayResponse>('POST', '/snailpay/charge', datos),

  // --- Carreras -----------------------------------------------------------

  obtenerDia: () => peticion<import('@snail/shared').SimulatedDay>('GET', '/races/today'),
};
