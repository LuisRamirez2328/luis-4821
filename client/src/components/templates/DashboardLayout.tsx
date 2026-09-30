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
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BalanceCard } from '../molecules/BalanceCard';
import { Button } from '../atoms/Button';
import { SnailPayForm } from '../organisms/SnailPayForm';
import type { SnailPayResponse } from '@snail/shared';

/** Tiempo que permanece el aviso de recarga antes de desaparecer solo. */
const DURACION_AVISO = 6000;

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, balance, cerrarSesion } = useAuth();
  const [modalAbierto, setModalAbierto] = useState(false);
  /*
   * El aviso vive aqui, y no dentro del modal, porque el modal se cierra solo
   * en cuanto la recarga se aprueba. Si el mensaje fuera parte del dialogo se
   * desmontaria con el y el usuario no veria ni el codigo de autorizacion.
   */
  const [aviso, setAviso] = useState<SnailPayResponse | null>(null);

  // El aviso se retira solo. El temporizador se cancela si el usuario lo
  // cierra antes o si llega otro aviso, para que no se pisen entre si.
  useEffect(() => {
    if (!aviso) {
      return;
    }
    const temporizador = setTimeout(() => setAviso(null), DURACION_AVISO);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        {/* Marca tipografica: dos bloques y una barra. No es un logo dibujado,
            es la palabra recortada, que es lo que hace el diseno de referencia. */}
        <span className="wordmark" aria-hidden="true">
          CARACOLES<span>/26</span>
        </span>

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
            <p className="dashboard__saludo">Sesion activa</p>
            <h1 className="dashboard__nombre">{user?.fullName}</h1>
          </div>
        </div>

        <div className="dashboard__acciones">
          <BalanceCard balance={balance} />
          <Button variant="recarga" onClick={() => setModalAbierto(true)}>
            Recargar <span aria-hidden="true">+</span>
          </Button>
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
      {modalAbierto ? (
        <SnailPayForm
          onClose={() => setModalAbierto(false)}
          onExito={(respuesta) => setAviso(respuesta)}
        />
      ) : null}

      {/*
        role="status" para que un lector de pantalla lo anuncie sin robarle el
        foco a quien esta en otra parte de la pagina. Va al final del DOM: se
        superpone, no desplaza el contenido.
      */}
      {aviso ? (
        <div className="toast" role="status">
          <div>
            <strong>Recarga exitosa.</strong> {aviso.status_detail}
            <span className="toast__mono">
              Autorizacion: {aviso.authorization_code}
            </span>
          </div>
          <button
            type="button"
            className="toast__cerrar"
            onClick={() => setAviso(null)}
            aria-label="Cerrar aviso"
          >
            &times;
          </button>
        </div>
      ) : null}
    </div>
  );
}
