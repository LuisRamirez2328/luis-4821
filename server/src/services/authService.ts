/**
 * SERVICIO DE AUTENTICACION
 * ---------------------------------------------------------------------------
 * Este es el nucleo de la seguridad de la aplicacion.
 *
 * DECISION CLAVE: las contrasenas se guardan hasheadas con bcrypt, nunca en
 * texto plano.
 *
 *   - bcrypt es lento a proposito. Ese costo computacional es justamente la
 *     defensa: hace que un ataque de fuerza bruta sea inviable.
 *   - Si usaramos SHA-256 a secas, un atacante podria calcular miles de
 *     millones de intentos por segundo. Con bcrypt, muy pocos por segundo.
 *   - bcrypt genera un salt aleatorio por cada hash y lo incrusta dentro del
 *     resultado. Por eso dos usuarios con la misma contrasena producen hashes
 *     distintos, y eso impide tablas precalculadas (rainbow tables).
 *   - La comparacion se hace con bcrypt.compare(), que revisa todos los bytes
 *     del hash. Un simple "===" devolveria temprano en cuanto encuentra una
 *     diferencia y filtraria informacion por tiempo de ejecucion.
 *
 * En produccion se evaluaria argon2, que es mas resistente a ataques con
 * hardware especializado (GPU/ASIC). Aqui bcryptjs se elige porque es puro
 * JavaScript y no requiere compilacion nativa.
 */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { AuthResponse, PublicUser, User } from '@snail/shared';
import { userStore } from '../data/store.js';
import { config } from '../config/index.js';
import { ErrorAplicacion } from '../middleware/errorHandler.js';

/**
 * Sesiones en memoria: token -> id de usuario.
 * En produccion esto viviria en Redis o en una tabla, para que la sesion
 * sobreviva al reinicio del servidor y se pueda invalidar de verdad.
 */
const sessions = new Map<string, string>();

/**
 * Convierte un User interno en el objeto que puede viajar al cliente.
 *
 * Es la unica proteccion contra filtrar el hash: si olvidas pasar por aqui y
 * mandas el User completo, estas exponiendo el hash (y con el, una via para
 * crackear la contrasena). Por eso PublicUser no tiene campo passwordHash.
 */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  };
}

/**
 * Crea un token de sesion aleatorio.
 *
 * randomBytes devuelve bytes impredecibles del sistema operativo. No se usa
 * Math.random() porque no es criptografico: su estado se puede reconstruir
 * observando unas pocas salidas.
 */
function crearToken(): string {
  return randomUUID();
}

/**
 * Registra un usuario nuevo.
 *
 * @throws Error 'El correo ya esta registrado' si ya existe.
 */
export async function registrar(
  fullName: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  // 1. Normalizar el correo ANTES de buscar.
  //    Si no, "Luis@correo.com" y "luis@correo.com" crearian dos cuentas
  //    distintas. El servidor de correo no distingue mayusculas.
  const correoNormalizado = email.toLowerCase().trim();

  const existente = userStore.findByEmail(correoNormalizado);
  if (existente) {
    throw new ErrorAplicacion('El correo ya esta registrado', 409, 'EMAIL_DUPLICADO');
  }

  // 2. Hashear la contrasena. config.bcryptRounds es el "work factor":
  //    cada vuelta duplica el costo. 10 es el equilibrio habitual entre
  //    seguridad y velocidad de respuesta.
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  // 3. Persistir. El usuario nace con saldo 0, como pide el enunciado.
  //    El saldo NO se guarda en el User: vive en el estado del cliente
  //    (LocalStorage), segun lo especificado.
  const user: User = {
    id: randomUUID(),
    fullName,
    email: correoNormalizado,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  userStore.insert(user);

  // 4. Abrir sesion automaticamente, para que el usuario entre al dashboard
  //    sin volver a escribir su contrasena.
  const token = crearToken();
  sessions.set(token, user.id);

  return { user: toPublicUser(user), token };
}

/**
 * Inicia sesion verificando correo y contrasena.
 *
 * Decisiones importantes:
 *   - Un unico mensaje de error para "correo inexistente" y "contrasena
 *     incorrecta". Si fueran distintos, un atacante podria enumerar quais
 *     correos estan registrados probando el formulario de login.
 *   - Cuando el correo no existe aun asi se ejecuta un bcrypt.compare() contra
 *     un hash ficticio. Asi el tiempo de respuesta es parecido en ambos casos
 *     y no se filtra informacion por duracion.
 *
 * @throws Error 'Credenciales invalidas' en cualquiera de los dos fallos.
 */
const HASH_FICTICIO =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export async function iniciarSesion(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const correoNormalizado = email.toLowerCase().trim();
  const user = userStore.findByEmail(correoNormalizado);

  if (!user) {
    // Comparacion en falso, solo por uniformity de tiempo de respuesta.
    await bcrypt.compare(password, HASH_FICTICIO);
    throw new ErrorAplicacion('Credenciales invalidas', 401, 'CREDENCIALES_INVALIDAS');
  }

  const esCorrecta = await bcrypt.compare(password, user.passwordHash);
  if (!esCorrecta) {
    throw new ErrorAplicacion('Credenciales invalidas', 401, 'CREDENCIALES_INVALIDAS');
  }

  const token = crearToken();
  sessions.set(token, user.id);

  return { user: toPublicUser(user), token };
}

/** Cierra la sesion eliminando el token. */
export function cerrarSesion(token: string): void {
  sessions.delete(token);
}

/**
 * Borra todas las sesiones. Existe solo para las pruebas, por el mismo
 * motivo que userStore.clear(): el Map es estado de modulo.
 */
export function reiniciarSesiones(): void {
  sessions.clear();
}

/**
 * Resuelve un token a su usuario.
 *
 * @returns el usuario, o undefined si el token no existe.
 */
export function usuarioDesdeToken(token: string): User | undefined {
  const userId = sessions.get(token);
  if (!userId) {
    return undefined;
  }
  return userStore.findById(userId);
}
