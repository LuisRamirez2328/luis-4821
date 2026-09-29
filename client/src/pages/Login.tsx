/**
 * PAGINA: Login
 * La pagina solo decide el MODO del formulario y el texto. Toda la logica
 * esta en AuthForm.
 */
import { useState } from 'react';
import { AuthLayout } from '../components/templates/AuthLayout';
import { AuthForm } from '../components/organisms/AuthForm';

export function Login() {
  const [modo, setModo] = useState<'login' | 'registro'>('login');

  return (
    <AuthLayout>
      <h2 className="auth-form__titulo">
        {modo === 'login' ? 'Inicia sesion' : 'Crea tu cuenta'}
      </h2>
      <AuthForm modo={modo} onCambiarModo={() => setModo(modo === 'login' ? 'registro' : 'login')} />
    </AuthLayout>
  );
}
