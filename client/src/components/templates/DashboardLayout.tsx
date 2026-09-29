/**
 * PLANTILLA: DashboardLayout
 * ---------------------------------------------------------------------------
 * Estructura comun del dashboard: cabecera con identidad, saldo, boton de
 * recarga y cierre de sesion; luego el area de graficos.
 *
 * El estado del modal de recarga vive AQUI y no en la pagina, porque abrirlo
 * o cerrarlo es una decision de la estructura (capa sobre el contenido), no
 * del contenido en si.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BalanceCard } from '../molecules/BalanceCard';
import { Button } from '../atoms/Button';
import { SnailPayForm } from '../organisms/SnailPayForm';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, balance, cerrarSesion } = useAuth();
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dashboard__identidad">
          {/* Avatar con iniciales: identifica sin pedir una imagen. */}
          <span className="avatar" aria-hidden="true">
            {(user?.fullName ?? '?')
              .split(' ')
              .map((p) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </span>
          <div>
            <p className="dashboard__saludo">Hola,</p>
            <h1 className="dashboard__nombre">{user?.fullName}</h1>
          </div>
        </div>

        <div className="dashboard__acciones">
          <BalanceCard balance={balance} />
          <Button onClick={() => setModalAbierto(true)}>Recargar</Button>
          <Button variant="secundario" onClick={() => void cerrarSesion()}>
            Cerrar sesion
          </Button>
        </div>
      </header>

      <main className="dashboard__main">{children}</main>

      {/*
        Montado condicionalmente: cuando esta cerrado no existe en el DOM, asi
        que no se puede enfocar por tabulacion ni leer por lector de pantalla.
      */}
      {modalAbierto ? <SnailPayForm onClose={() => setModalAbierto(false)} /> : null}
    </div>
  );
}
