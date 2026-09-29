/**
 * MOLECULA: FormField
 * ---------------------------------------------------------------------------
 * Agrupa Label + Input + mensaje de error en una unidad. Es el patron
 * "compound component" simplificado: el componente que sabe de las tres piezas
 * pero no de ninguna en particular.
 *
 * Por que agruparlos: si cada formularioarmara el trio a mano, un error
 * olvidaria el mensaje en uno de los tres formularios, y el usuario no sabria
 * que paso.
 */
import { Label } from '../atoms/Label';
import { Input } from '../atoms/Input';

interface FormFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'number';
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
}

export function FormField({
  id,
  name,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  error,
  disabled = false,
  min,
  max,
  maxLength,
}: FormFieldProps) {
  return (
    <div className="form-field">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        min={min}
        max={max}
        maxLength={maxLength}
      />
      {/*
        aria-describedby conecta el mensaje con el input para lectores de
        pantalla. role="alert" hace que se anuncie al aparecer.
      */}
      {error ? (
        <p className="form-field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
