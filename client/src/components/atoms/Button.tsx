/**
 * Boton sin logica propia. La variante "recarga" existe porque en la barra de
 * navegacion el CTA navy y el boton de recarga quedarian pegados con el mismo
 * aspecto; separarlos por valor y no por color mantiene una sola familia de
 * color en toda la interfaz.
 */
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  /**
   * primario: navy solido, la accion de mayor peso.
   * recarga: acero medio con texto navy.
   * secundario: solo filete.
   * peligro: rojo, unico color funcional.
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
