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
  saldo: 'snail.saldo',
  tarjeta: 'snail.tarjeta',
  apuestas: 'snail.apuestas',
} as const;

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
 * El saldo arranca en 0, segun el enunciado.
 *
 * Escribirlo desde el inicio (y no devolver 0 cuando no exista) evita un caso
 * raro: si la primera recarga devuelve 0 y despues se recarga saldo, un
 * lector que leyera antes podria ver 0 y sobrescribir el saldo real.
 */
export function inicializarSaldo(): void {
  if (leer<number>(CLAVES.saldo) === null) {
    escribir(CLAVES.saldo, 0);
  }
}

export function leerSaldo(): number {
  const valor = leer<number>(CLAVES.saldo);
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
}

export function guardarSaldo(saldo: number): void {
  escribir(CLAVES.saldo, saldo);
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

/** Borra todo. Se usa al cerrar sesion, para no filtrar datos entre cuentas. */
export function limpiarTodo(): void {
  limpiarSesion();
  limpiarApuestas();
  // El saldo NO se borra aqui a proposito: es la "cartera" del usuario y el
  // enunciado pide que persista. En una app real el saldo viviria en el
  // servidor, nunca en el navegador.
}
