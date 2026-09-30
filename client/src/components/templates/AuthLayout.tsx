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
        {/* Marca dibujada en SVG, no un emoji. El emoji se renderiza con la
            fuente del sistema, cambia entre maquinas y a partir de 40px se ve
            como un marcador de posicion sin borrar. */}
        <svg
          className="marca-glifo"
          viewBox="0 0 44 40"
          width="44"
          height="40"
          aria-hidden="true"
          focusable="false"
        >
          {/* Caracol: espiral exterior y segunda vuelta interior. */}
          <path
            d="M21.5 26.5c-6.4 0-11.6-3.9-11.6-8.7 0-4.4 4.8-7.8 11.6-7.8 5.6 0 10 2.6 10 6.2 0 2.5-2.1 4.1-4.5 4.1-2.1 0-3.6-1.4-3.6-3.2 0-1.4 1.1-2.4 2.4-2.4 1 0 1.7.6 1.7 1.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Cuerpo. */}
          <path
            d="M9 31.5h22"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Ojo. */}
          <circle cx="12.5" cy="23.5" r="1.6" fill="currentColor" />
        </svg>
        <h1 className="auth-layout__titulo">Carreras de Caracoles</h1>
        <p className="auth-layout__subtitulo">
          Sigue el ritmo de las seis carreras del dia.
        </p>
      </div>
      <div className="auth-layout__panel">{children}</div>
    </div>
  );
}
