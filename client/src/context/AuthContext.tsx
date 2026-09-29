/**
 * CONTEXTO DE AUTENTICACION
 * ===========================================================================
 * React no tiene un estado global incorporado. El problema: la sesion la
 * necesitan el boton de logout (en el layout) y el dashboard. Pasarla por
 * props ahi obliga a repetirla en cada nivel intermedio.
 *
 * Context crea un "canal" invisible: cualquier componente puede leerlo con
 * useAuth() sin recibir props. Se declara en main.tsx como ancestro de <App/>,
 * y por eso todo el arbol tiene acceso.
 *
 * ---------------------------------------------------------------------------
 * ESTADOS DE LA SESION
 * ---------------------------------------------------------------------------
 *   cargando -> verificando el token guardado con el servidor
 *   sin sesion -> no hay token valido, mostrar login
 *   con sesion -> token valido, mostrar dashboard
 *
 * El estado "cargando" es indispensable: sin el, al recargar la pagina la app
 * llegaria a conclusion "estoy deslogueado" antes de tener respuesta del
 * servidor, y expulsaria al usuario. Ese parpadeo es el bug clasico al
 * implementar "mantener la sesion".
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
    async function restaurar() {
      const guardada = leerSesion();
      if (!guardada) {
        setEstado('sin-sesion');
        return;
      }

      try {
        const { user: usuario } = await api.verificarSesion();
        setUser(usuario);
        inicializarSaldo();
        setBalance(leerSaldo());
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
      inicializarSaldo();
      setUser(respuesta.user);
      setBalance(0);
      setEstado('con-sesion');
    },
    [],
  );

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const respuesta = await api.iniciarSesion(email, password);
    guardarSesion({ token: respuesta.token, user: respuesta.user });
    inicializarSaldo();
    setUser(respuesta.user);
    setBalance(leerSaldo());
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
   */
  const recargarSaldo = useCallback((monto: number) => {
    const nuevo = leerSaldo() + monto;
    guardarSaldo(nuevo);
    setBalance(nuevo);
  }, []);

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
