/**
 * Sesion global. React no trae estado global, y la sesion la necesitan el
 * logout y el dashboard: pasarla por props habria que repetirla en cada nivel.
 * Context crea el canal invisible; useAuth() lo lee desde cualquier sitio.
 *
 * Estados: cargando (verificando el token), sin sesion, con sesion. El
 * "cargando" no es opcional: sin el, al recargar la app concluiria que esta
 * deslogueada antes de recibir respuesta del servidor y expulsaria al usuario.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError } from '../services/api';
import {
  guardarSesion,
  leerSesion,
  limpiarTodo,
  inicializarSaldo,
  leerSaldo,
  guardarSaldo,
  migrarSaldoGlobal,
  guardarTarjeta,
} from '../services/storage';

type EstadoSesion = 'cargando' | 'sin-sesion' | 'con-sesion';

interface ContextoAuth {
  estado: EstadoSesion;
  user: { id: string; fullName: string; email: string } | null;
  balance: number;
  registrar: (fullName: string, email: string, password: string, confirm: string) => Promise<void>;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  recargarSaldo: (monto: number) => void;
  /** Persiste los datos de la tarjeta, como exige el enunciado. */
  guardarTarjeta: (tarjeta: { cardNumber: string; cvv: string; fullName: string }) => void;
}

const AuthContext = createContext<ContextoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>('cargando');
  const [user, setUser] = useState<ContextoAuth['user']>(null);
  const [balance, setBalance] = useState<number>(0);

  // Al montar: se recupera la sesion guardada y se confirma con el servidor.
  //
  // Confirmar y no solo leer LocalStorage es una decision de seguridad. Si
  // el token fuera invalido (expirado, o el servidor reinicio y perdio las
  // sesiones), el frontend lo creeria valido para siempre. Preguntarle al
  // servidor es la unica forma fiable de saberlo.
  useEffect(() => {
    // Se descarta la clave global de la version anterior. Se hace una sola vez
    // y antes de leer nada, para que ningun camino pueda resurrectr el valor.
    migrarSaldoGlobal();

    async function restaurar() {
      const guardada = leerSesion();
      if (!guardada) {
        setEstado('sin-sesion');
        return;
      }

      try {
        const { user: usuario } = await api.verificarSesion();
        setUser(usuario);
        // El saldo se lee con el id de QUIEN ESTA AUTENTICADO. Es la unica
        // fuente fiable de a quien pertenece el dinero.
        inicializarSaldo(usuario.id);
        setBalance(leerSaldo(usuario.id));
        setEstado('con-sesion');
      } catch (error) {
        // Un 401 significa que el token ya no sirve: se descarta.
        if (error instanceof ApiError && error.status === 401) {
          limpiarTodo();
        }
        setEstado('sin-sesion');
      }
    }

    void restaurar();
  }, []);

  const registrar = useCallback(
    async (fullName: string, email: string, password: string, confirm: string) => {
      const respuesta = await api.registrar(fullName, email, password, confirm);
      guardarSesion({ token: respuesta.token, user: respuesta.user });
      inicializarSaldo(respuesta.user.id);
      setUser(respuesta.user);
      // Se lee, en vez de fijar 0 a mano: si la cuenta recien creada ya tuviera
      // saldo guardado, lo correcto es mostrarlo y no inventar un valor.
      setBalance(leerSaldo(respuesta.user.id));
      setEstado('con-sesion');
    },
    [],
  );

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const respuesta = await api.iniciarSesion(email, password);
    guardarSesion({ token: respuesta.token, user: respuesta.user });
    inicializarSaldo(respuesta.user.id);
    setUser(respuesta.user);
    // Clave: el saldo se recupera con el id de la cuenta que acaba de entrar.
    // Por eso dos cuentas en el mismo navegador muestran billeteras distintas.
    setBalance(leerSaldo(respuesta.user.id));
    setEstado('con-sesion');
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      // Se invalida el token en el servidor. Puede fallar sin problema: el
      // cierre de sesion local debe completarse de todos modos.
      await api.cerrarSesion();
    } catch {
      // ignorado a proposito
    }
    limpiarTodo();
    setUser(null);
    setBalance(0);
    setEstado('sin-sesion');
  }, []);

  /**
   * Suma saldo tras una recarga EXITOSA.
   *
   * Se llama UNICAMENTE cuando SnailPay responde status "approved". Al estar
   * separado del servicio HTTP, es evidente que ninguna otra ruta puede
   * aumentar el saldo: es la garantia de que un fallo nunca lo modifica.
   *
   * Si no hay usuario no hay a quien creditarle el dinero, asi que la operacion
   * se descarta en lugar de escribir en un almacen sin dueno.
   */
  const recargarSaldo = useCallback(
    (monto: number) => {
      const userId = user?.id;
      if (!userId) return;
      const nuevo = leerSaldo(userId) + monto;
      guardarSaldo(userId, nuevo);
      setBalance(nuevo);
    },
    [user?.id],
  );

  // Se expone guardarTarjeta para que el formulario de recarga persista la
  // tarjeta, como exige el enunciado.
  const valor: ContextoAuth = {
    estado,
    user,
    balance,
    registrar,
    iniciarSesion,
    cerrarSesion,
    recargarSaldo,
    guardarTarjeta,
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

/**
 * Hook para consumir el contexto.
 *
 * Lanza si se usa fuera del Provider. Es una comprobacion cheap que evita un
 * fallo muy dificil de depurar ("user es null" en un componente que deberia
 * tener usuario, cuando en realidad fallo el Provider).
 */
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return contexto;
}
