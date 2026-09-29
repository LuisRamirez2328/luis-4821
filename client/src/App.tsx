/**
 * ENRUTADOR DE LA APLICACION
 * ---------------------------------------------------------------------------
 * Define las rutas y decide que se muestra en cada una.
 *
 * El elemento central es <RutaPrivada>: envuelve las pantallas que exigen
 * sesion. Es la contraparte del middleware exigirSesion del servidor.
 *
 * ---------------------------------------------------------------------------
 * POR QUE HAY UNA GUARDA EN EL CLIENTE Y OTRA EN EL SERVIDOR
 * ---------------------------------------------------------------------------
 * Son capas distintas y ninguna sobra:
 *
 *   Cliente: mejora la EXPERIENCIA. Evita mostrar el dashboard y luego
 *   expulsar al usuario con un error. Barato y visible.
 *
 *   Servidor: aporta la SEGURIDAD. Si solo existiera la guarda del cliente,
 *   bastaria con llamar la API a mano desde la consola. El servidor es la
 *   unica capa en la que se puede confiar, porque no se puede saltar.
 *
 * Proteger solo el cliente es el error clasico de seguridad web.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';

function RutaPrivada({ children }: { children: React.ReactNode }) {
  const { estado } = useAuth();

  // Mientras se verifica el token guardado, NO se decide nada. Sin esto, al
  // recargar la pagina se redirigiria al login antes de tiempo y el usuario
  // perderia la sesion.
  if (estado === 'cargando') {
    return <p className="cargando cargando--centro">Verificando sesion...</p>;
  }

  if (estado === 'sin-sesion') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RedirigirSiHaySesion({ children }: { children: React.ReactNode }) {
  const { estado } = useAuth();

  if (estado === 'cargando') {
    return <p className="cargando cargando--centro">Verificando sesion...</p>;
  }
  // Si ya hay sesion, entrar a /login no tiene sentido: va al dashboard.
  if (estado === 'con-sesion') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/**
 * Solo las rutas, sin el router.
 *
 * Se separa de <App> para que las pruebas puedan montarla dentro de un
 * MemoryRouter. Anidar dos routers produce avisos y comportamiento ambiguo:
 * por eso la version testeable no incluye el BrowserRouter.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* replace evita acumular historial: el boton "atras" no devuelve al login. */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/login"
        element={
          <RedirigirSiHaySesion>
            <Login />
          </RedirigirSiHaySesion>
        }
      />
      <Route
        path="/register"
        element={
          <RedirigirSiHaySesion>
            <Register />
          </RedirigirSiHaySesion>
        }
      />

      <Route
        path="/dashboard"
        element={
          <RutaPrivada>
            <Dashboard />
          </RutaPrivada>
        }
      />

      {/* Cualquier ruta desconocida lleva al inicio. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Componente raiz: aporta el router y las rutas. */
export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
