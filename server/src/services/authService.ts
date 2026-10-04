/**
 * Hash con bcrypt, nunca en texto plano, aunque sea una simulacion local.
 * bcrypt es lento a proposito: SHA-256 permitiria millones de intentos por
 * segundo y bcrypt muy pocos. Cada hash lleva su propio salt, asi que dos
 * contrasenas iguales no dan el mismo hash. En produccion argon2 seria mejor
 * frente a GPU; aqui se usa bcryptjs por ser JavaScript puro.
 */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { AuthResponse, PublicUser, User } from '@snail/shared';
import { userStore } from '../data/store.js';
import { config } from '../config/index.js';
import { ErrorAplicacion } from '../middleware/errorHandler.js';

// En memoria: en produccion viviria en Redis o en una tabla, para que la
// sesion sobreviva al reinicio y se pueda invalidar de verdad.
const sessions = new Map<string, string>();

// Unica proteccion contra filtrar el hash: si se manda el User entero, se
// expone el hash y con el una via para crackear la contrasena.
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  };
}

// randomUUID es impredecible; Math.random() no lo es y se puede reconstruir
// su estado observando unas pocas salidas.
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
 * Un unico mensaje para "correo inexistente" y "contrasena incorrecta": si
 * fueran distintos, el formulario serviria para enumerar correos registrados.
 * Cuando el correo no existe se compara igual contra un hash ficticio, para
 * que el tiempo de respuesta no delate el caso.
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

// Solo para pruebas: el Map es estado de modulo y contaminaria otras suites.
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
