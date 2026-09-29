/**
 * ATOMO: Card
 * Una superficie con borde. Agrupa contenido, sin impose nada.
 */
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
}

export function Card({ children, title }: CardProps) {
  return (
    <section className="card">
      {title ? <h2 className="card__title">{title}</h2> : null}
      {children}
    </section>
  );
}
