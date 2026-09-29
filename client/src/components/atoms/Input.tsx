/**
 * ATOMO: Input
 *
 * Un detalle de accesibilidad que importa: no se puede poner un <label> dentro
 * del input. La etiqueta va como atributo `htmlFor` y el input con `id`. Asi el
 * navegador la asocia y, al hacer clic en el texto, el foco va al campo.
 */
import type { ChangeEvent } from 'react';

interface InputProps {
  id: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  /** Limites numericos. Solo aplican a type="number". */
  min?: number;
  max?: number;
  maxLength?: number;
}

export function Input({
  id,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled = false,
  min,
  max,
  maxLength,
}: InputProps) {
  function manejarCambio(evento: ChangeEvent<HTMLInputElement>) {
    const nuevo = evento.target.value;

    // Barrera de formato para campos numericos: se descartan los caracteres
    // que no son digitos. type="number" por si solo NO impide pegar texto
    // ("1234123412341234" es un numero valido, asi que lo acepta), y eso
    // permitia colar un numero de tarjeta en el campo de monto.
    if (type === 'number' && nuevo !== '' && !/^\d*$/.test(nuevo)) {
      return;
    }

    onChange(nuevo);
  }

  return (
    <input
      id={id}
      name={name}
      type={type}
      className="input"
      value={value}
      onChange={manejarCambio}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      min={min}
      max={max}
      // Se limitan los digitos del numero de tarjeta a 19, que es el maximo
      // real de un PAN. Evita teclear de mas.
      maxLength={maxLength}
      inputMode={type === 'number' ? 'numeric' : undefined}
    />
  );
}
