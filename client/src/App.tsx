/**
 * Rutas y que se muestra en cada una. <RutaPrivada> envuelve las pantallas que
 * exigen sesion.
 *
 * Hay guarda en cliente y en servidor porque son capas distintas: el cliente
 * mejora la experiencia y el servidor aporta la seguridad, que es la unica que
 * no se puede saltar desde la consola.
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
 * Sin el router, para que las pruebas puedan montarla en un MemoryRouter:
 * anidar dos routers produce avisos y comportamiento ambiguo.
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
