/**
 * Agrupa Label + Input + mensaje de error. Si cada formulario armara el trio a
 * mano, uno se olvidaria del mensaje y el usuario no sabria que paso.
 */
import type { ReactNode } from 'react';
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
  /**
   * Pieza a la derecha del campo, sobre el filete.
   *
   * Se usa para el interruptor de mostrar contrasena. Va fuera del Input a
   * proposito: el boton no pertenece al campo de texto, y meterlo dentro
   * haria que un lector de pantalla lo anunciara como parte de la etiqueta.
   */
  accion?: ReactNode;
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
  accion,
}: FormFieldProps) {
  return (
    <div className={`form-field${accion ? ' form-field--con-accion' : ''}`}>
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
      {accion}
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
