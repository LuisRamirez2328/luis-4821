/**
 * PLANTILLA: AuthLayout
 * ---------------------------------------------------------------------------
 * En Atomic Design, una plantilla define la ESTRUCTURA de una pantalla y
 * deja un hueco (children) donde se inyecta el contenido.
 *
 * Sirve para que login y registro compartan el mismo marco sin duplicarlo.
 */
import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-layout">
      <div className="auth-layout__marca">
        <span className="auth-layout__logo" aria-hidden="true">
          🐌
        </span>
        <h1 className="auth-layout__titulo">Carreras de Caracoles</h1>
        <p className="auth-layout__subtitulo">
          Sigue el ritmo de las seis carreras del dia.
        </p>
      </div>
      <div className="auth-layout__panel">{children}</div>
    </div>
  );
}
