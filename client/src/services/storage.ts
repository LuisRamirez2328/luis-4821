/**
 * Sesion, saldo y tarjeta en localStorage, no en sessionStorage: el enunciado
 * pide que la sesion sobreviva al F5, y sessionStorage se borra al cerrar la
 * pestana.
 *
 * La contrasena nunca se guarda, ni en claro ni hasheada: un hash sigue siendo
 * mas lento de romper que una contrasena directa, asi que guardarla seria
 * exposure, no seguridad.
 *
 * Riesgo asumido: localStorage es legible por cualquier script de la pagina,
 * asi que un XSS podria leer el token y la tarjeta. Se limita el dano guardando
 * solo lo necesario.
 */

/** Claves de LocalStorage. Centralizadas para no repetir cadenas. */
const CLAVES = {
  sesion: 'snail.sesion',
  prefijoSaldo: 'snail.saldo.',
  tarjeta: 'snail.tarjeta',
  apuestas: 'snail.apuestas',
} as const;

// Clave del saldo legado (global). Solo se usa para borrarla en la migracion.
const SALDO_LEGADO = 'snail.saldo';

// localStorage puede no existir (modo privado) o guardar JSON invalido.
// En ambos casos se devuelve null en vez de romper la app.
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

// Sesion

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

// Saldo
// El saldo va indexado por usuario. La primera version usaba una clave global
// y eso hacia que dos cuentas en el mismo navegador compartieran billetera, y
// que un valor erroneo sobreviviera a cada cierre de sesion.

// LocalStorage es editable a mano, asi que un numero de ahi no es creible.
// El techo descarta valores absurdos en vez de dejarlos pasar como dinero.
// Es holgado a proposito: con el limite de 20 000 por recarga, llegar aqui
// exigiria cincuenta mil recargas.
const SALDO_MAXIMO = 1_000_000_000;

function claveSaldo(userId: string): string {
  return `${CLAVES.prefijoSaldo}${userId}`;
}

// Normaliza al escribir y al leer: un valor corrupto no debe quedar en memoria
// como si fuera un saldo valido.
function normalizarSaldo(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 0;
  if (!Number.isInteger(valor)) return 0;
  if (valor < 0) return 0;
  if (valor > SALDO_MAXIMO) return SALDO_MAXIMO;
  return valor;
}

// Se escribe desde el inicio y no se devuelve 0 al leer: si la primera recarga
// devolviera 0 y luego se recargara saldo, una lectura anterior podria ver 0 y
// sobrescribir el saldo real.
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

// No se intenta conservar el valor: al ser global no se sabe a quien pertenece,
// y en la practica arrastra saldos corruptos. Se borra una sola vez.
export function migrarSaldoGlobal(): void {
  borrar(SALDO_LEGADO);
}

// Datos de la tarjeta

export interface TarjetaGuardada {
  cardNumber: string;
  cvv: string;
  fullName: string;
}

// El enunciado exige persistir la tarjeta. En un sistema real seria
// inaceptable (el CVV jamas puede almacenarse y el numero solo por
// tokenizacion); aqui se cumple por requerimiento, con datos ficticios.
export function guardarTarjeta(tarjeta: TarjetaGuardada): void {
  escribir(CLAVES.tarjeta, tarjeta);
}

export function leerTarjeta(): TarjetaGuardada | null {
  return leer<TarjetaGuardada>(CLAVES.tarjeta);
}

// Apuestas

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
  // El saldo NO se borra: al estar indexado por usuario, el valor pertenece a ESA
  // cuenta y no puede verse desde otra, y el enunciado pide que la sesion
  // sobreviva a un F5.
}
