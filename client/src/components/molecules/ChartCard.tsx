/**
 * MOLECULA: ChartCard
 * Contenedor comun para los dos graficos. Existe para que ambos se vean
 * identicos: mismo titulo, mismo padding, mismo alto. Si cada grafico trajera
 * sus propios estilos, divergiran en la primera modificacion de CSS.
 */
import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <section className="chart-card">
      <header className="chart-card__header">
        <h2 className="chart-card__title">{title}</h2>
        {subtitle ? <p className="chart-card__subtitle">{subtitle}</p> : null}
      </header>
      <div className="chart-card__body">{children}</div>
    </section>
  );
}
