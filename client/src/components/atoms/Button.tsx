/**
 * ATOMO: Button
 * El componente mas pequeno con proposito propio. Un solo boton, sin logica.
 */
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primario' | 'secundario' | 'peligro';
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
