/**
 * SERVICIO DE ALMACENAMIENTO (LocalStorage)
 * ===========================================================================
 * El enunciado exige explicitamente que el usuario, la sesion y el saldo se
 * guarden en el navegador, y que la sesion sobreviva a un F5.
 *
 * ---------------------------------------------------------------------------
 * QUE SE GUARDA Y QUE NO
 * ---------------------------------------------------------------------------
 *   SI   -> token de sesion, datos publicos del usuario, saldo,
 *           datos de la tarjeta usada en la recarga.
 *   NO   -> contrasena. NUNCA. Ni en claro ni hasheada.
 *
 * ---------------------------------------------------------------------------
 * POR QUE NO SE USA sessionStorage
 * ---------------------------------------------------------------------------
 * sessionStorage se borra al cerrar la pestaña. El enunciado pide que la
 * sesion persista, asi que la unica opcion correcta es localStorage.
 *
 * ---------------------------------------------------------------------------
 * RIEGO CONOCIDO Y ACEPTADO
 * ---------------------------------------------------------------------------
 * localStorage es accesible desde cualquier script de la pagina. Si alguna
 * vez se inserta un XSS, podria leer el token y la tarjeta. Es una limitacion
 * real del enfoque que pide el enunciado; se mitiga en la medida de lo posible
 * guardando solo lo necesario y nunca la contrasena, y se documenta como
 *RIESgo asumido.
 *
 * Nota sobre la contrasena: guardarla seria el error clasico. Aunque fuera
 * hasheada, un hash es mas lento de romper que una contrasena directa, asi que
 * seria EXPOSITIVO, no seguro.
 */

/** Claves de LocalStorage. Centralizadas para no repetir cadenas. */
const CLAVES = {
  sesion: 'snail.sesion',
  prefijoSaldo: 'snail.saldo.',
  tarjeta: 'snail.tarjeta',
  apuestas: 'snail.apuestas',
} as const;

/**
 * Clave del saldo LEGADO: una sola clave global para todos los usuarios.
 *
 * Se conserva solo para poder borrarla en la migracion. Ver `SALDO_MAXIMO` y
 * `migrarSaldoGlobal` para por que se abandona este esquema.
 */
const SALDO_LEGADO = 'snail.saldo';

/**
 * Lee y parsea un valor de LocalStorage de forma segura.
 *
 * Puede fallar por dos motivos reales:
 *   - localStorage no existe (modo privado de algunos navegadores, o SSR).
 *   - el valor guardado es JSON invalido (quedo a medias, o alguien lo edito).
 * En ambos casos se devuelve null en vez de romper la app.
 */
function leer<T>(clave: string): T | null {
  try {
    const bruto = window.localStorage.getItem(clave);
    if (bruto === null) return null;
    return JSON.parse(bruto) as T;
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: unknown): void {
  try {
    window.localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Cuota excedida o almacenamiento deshabilitado. La app sigue funcionando
    // en memoria; solo se pierde la persistencia.
  }
}

function borrar(clave: string): void {
  try {
    window.localStorage.removeItem(clave);
  } catch {
    // sin accion: si no se puede borrar, tampoco se puede guardar
  }
}

// --- Sesion ----------------------------------------------------------------

export interface SesionGuardada {
  token: string;
  user: { id: string; fullName: string; email: string };
}

export function guardarSesion(sesion: SesionGuardada): void {
  escribir(CLAVES.sesion, sesion);
}

export function leerSesion(): SesionGuardada | null {
  return leer<SesionGuardada>(CLAVES.sesion);
}

export function limpiarSesion(): void {
  borrar(CLAVES.sesion);
}

// --- Saldo -----------------------------------------------------------------
/**
 * ---------------------------------------------------------------------------
 * POR QUE EL SALDO VA POR USUARIO Y NO EN UNA CLAVE GLOBAL
 * ---------------------------------------------------------------------------
 * La primera version guardaba el saldo en 'snail.saldo', una unica clave para
 * toda la aplicacion. Eso era incorrecto por dos motivos concretos:
 *
 *   1. El saldo es un dato de la CUENTA, no del navegador. Con una clave
 *      global, dos cuentas distintas abiertas en el mismo navegador
 *      comparten la misma billetera: el dinero de una persona aparece en la
 *      pantalla de otra.
 *   2. Al cerrar sesion el valor se conservaba a proposito ("es la cartera del
 *      usuario"), asi que un valor erroneo, escrito a mano o producido por un
 *      fallo, sobrevivia indefinidamente y reaparecia en cada inicio de sesion.
 *
 * Se resuelve indexando la clave por identificador de usuario. Ahora cada
 * cuenta tiene su propio saldo y solo se restaura al entrar en ESA cuenta.
 */

/**
 * Tope del saldo.
 *
 * LocalStorage es editable a mano por quien use el navegador, asi que leer un
 * numero de ahi no significa que sea creible. Este techo convierte un valor
 * absurdo en un dato invalido en lugar de dejarlo pasar como si fuera dinero.
 *
 * El techo es holgado a proposito: con el limite de 10 000 por recarga, llegar
 * a mil millones exigiria cien mil recargas. No se trata de frenar al usuario,
 * sino de descartar valores que no pueden proceder de la app.
 */
const SALDO_MAXIMO = 1_000_000_000;

function claveSaldo(userId: string): string {
  return `${CLAVES.prefijoSaldo}${userId}`;
}

/**
 * Normaliza un saldo leido del almacenamiento.
 *
 * Se aplica tanto al leer como al escribir, de modo que un valor corrupto
 * nunca llega a estar en memoria ni ocupa lugar como dato valido.
 */
function normalizarSaldo(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 0;
  if (!Number.isInteger(valor)) return 0;
  if (valor < 0) return 0;
  if (valor > SALDO_MAXIMO) return SALDO_MAXIMO;
  return valor;
}

/**
 * El saldo arranca en 0, segun el enunciado.
 *
 * Escribirlo desde el inicio (y no devolver 0 cuando no exista) evita un caso
 * raro: si la primera recarga devuelve 0 y despues se recarga saldo, un
 * lector que leyera antes podria ver 0 y sobrescribir el saldo real.
 */
export function inicializarSaldo(userId: string): void {
  if (leer<number>(claveSaldo(userId)) === null) {
    escribir(claveSaldo(userId), 0);
  }
}

export function leerSaldo(userId: string): number {
  return normalizarSaldo(leer<unknown>(claveSaldo(userId)));
}

export function guardarSaldo(userId: string, saldo: number): void {
  escribir(claveSaldo(userId), normalizarSaldo(saldo));
}

/**
 * Elimina la clave global del saldo que usaba la primera version.
 *
 * No se intenta conservar su valor: era compartido entre cuentas, asi que no
 * es posible saber a quien pertenecía. Ademas, en la practica arrastra saldos
 * corruptos, que es justamente lo que se quiere descartar. Se borra una sola
 * vez y no tiene coste en ejecuciones posteriores.
 */
export function migrarSaldoGlobal(): void {
  borrar(SALDO_LEGADO);
}

// --- Datos de la tarjeta ---------------------------------------------------

export interface TarjetaGuardada {
  cardNumber: string;
  cvv: string;
  fullName: string;
}

/**
 * Guarda los datos de la ultima tarjeta usada.
 *
 * ADVERTENCIA: el enunciado exige que se persistan. En un sistema real esto
 * seria inaceptable (el CVV jamas puede almacenarse, y el numero de tarjeta
 * solo por tokenizacion). Aqui se cumple por requerimiento, con datos
 * ficticios, y se documenta el riesgo.
 */
export function guardarTarjeta(tarjeta: TarjetaGuardada): void {
  escribir(CLAVES.tarjeta, tarjeta);
}

export function leerTarjeta(): TarjetaGuardada | null {
  return leer<TarjetaGuardada>(CLAVES.tarjeta);
}

// --- Apuestas --------------------------------------------------------------

export interface ApuestaGuardada {
  raceId: string;
  snailId: string;
  amount: number;
  createdAt: string;
}

export function guardarApuesta(apuesta: ApuestaGuardada): void {
  const actuales = leer<ApuestaGuardada[]>(CLAVES.apuestas) ?? [];
  escribir(CLAVES.apuestas, [...actuales, apuesta]);
}

export function leerApuestas(): ApuestaGuardada[] {
  return leer<ApuestaGuardada[]>(CLAVES.apuestas) ?? [];
}

export function limpiarApuestas(): void {
  borrar(CLAVES.apuestas);
}

/** Borra sesion y apuestas. Se usa al cerrar sesion, para no filtrar datos entre cuentas. */
export function limpiarTodo(): void {
  limpiarSesion();
  limpiarApuestas();
  // El saldo NO se borra aqui, y ahora es correcto no hacerlo: al estar
  // indexado por usuario, el valor pertenece a ESA cuenta y no puede verse
  // desde otra. Se restaura al entrar de nuevo en la misma cuenta.
  //
  // Ademas, el enunciado pide que la sesion sobreviva a un F5, y el saldo es
  // parte de lo que el usuario espera conservar entre visitas.
}
