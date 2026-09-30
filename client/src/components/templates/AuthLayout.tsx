/**
 * PLANTILLA: AuthLayout
 * ---------------------------------------------------------------------------
 * En Atomic Design, una plantilla define la ESTRUCTURA de una pantalla y
 * deja un hueco (children) donde se inyecta el contenido.
 *
 * Sirve para que login y registro compartan el mismo marco sin duplicarlo.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTA DIVIDIDA EN DOS PANELES
 * ---------------------------------------------------------------------------
 * El panel de marca no es decoracion: sostiene el titulo grande, que es la
 * primera impresion del sitio. El formulario, en cambio, cambia entre login y
 * registro pero comparte caja, encabezado yfilete, asi que no necesita su
 * propia pantalla.
 */
import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  /** Antetitulo en versalitas sobre el titulo del formulario. */
  eyebrow: string;
  /** Titulo del formulario. */
  titulo: string;
  /** Linea de apoyo bajo el titulo. */
  intro: string;
}

export function AuthLayout({ children, eyebrow, titulo, intro }: AuthLayoutProps) {
  return (
    <main className="auth-shell">
      {/* --- Panel de marca ------------------------------------------------- */}
      <section className="brand-panel" aria-labelledby="brand-title">
        <div className="brand-header">
          {/* Simbolo: un circulo con un punto, el gesto minimo que ya
              distingue la marca sin recurrir a un logotipo ilustrado. */}
          <span className="brand-symbol" aria-hidden="true">
            <span />
          </span>
          <span>CC / 026</span>
        </div>

        <div className="brand-content">
          <p className="eyebrow">LIGA DE RITMO LENTO</p>
          <h1 id="brand-title">
            Corre a tu
            <br />
            <strong>propio ritmo.</strong>
          </h1>
          <p className="brand-copy">
            Seis caracoles, seis carreras y un unico dia simulado. Los datos
            son de muestra, la logica de recarga es real.
          </p>

          {/* Cifras de la propia simulacion, no inventadas para rellenar. */}
          <div className="stat-row">
            <div>
              <strong>06</strong>
              <span>carreras</span>
            </div>
            <div>
              <strong>06</strong>
              <span>caracoles</span>
            </div>
            <div>
              <strong>00</strong>
              <span>apuestas</span>
            </div>
          </div>
        </div>

        <div className="brand-footer">
          <span>CARACOL CLUB</span>
          <span>EST. 2026</span>
        </div>
      </section>

      {/* --- Formulario ----------------------------------------------------- */}
      <section className="auth-card" aria-labelledby="form-title">
        <div className="card-topline">
          <span className="status-dot" aria-hidden="true" />
          Temporada 2026 · Datos simulados
        </div>

        <div className="card-heading">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="form-title">{titulo}</h2>
          <p className="form-intro">{intro}</p>
        </div>

        {children}
      </section>
    </main>
  );
}