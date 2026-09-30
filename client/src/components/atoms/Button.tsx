/**
 * ATOMO: Button
 * El componente mas pequeno con proposito propio. Un solo boton, sin logica.
 */
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  /**
   * Variantes:
   *  - primario: navy solido, la accion de mayor peso de la pantalla.
   *  - recarga: acero medio con texto navy. Existe porque en la barra de
   *    navegacion el CTA navy y el boton de recarga quedarian pegados y con el
   *    mismo aspecto. Separarlos por valor, no por color, mantiene una sola
   *    familia de color en toda la interfaz.
   *  - secundario: solo filete.
   *  - peligro: rojo, unico color funcional.
   */
  variant?: 'primario' | 'recarga' | 'secundario' | 'peligro';
  disabled?: boolean;
  fullWidth?: boolean;
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primario',
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const clases = [
    'btn',
    `btn--${variant}`,
    fullWidth ? 'btn--full' : '',
    disabled ? 'btn--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={clases} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
