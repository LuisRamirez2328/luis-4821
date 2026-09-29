/**
 * PAGINA: Register
 * Comparte la pantalla completa con Login. Se mantiene como pagina separada
 * para que las rutas /login y /register existan por separado, que es lo que
 * espera el enunciado, aunque visualmente sean la misma vista.
 */
import { useState } from 'react';
import { AuthLayout } from '../components/templates/AuthLayout';
import { AuthForm } from '../components/organisms/AuthForm';

export function Register() {
  const [modo, setModo] = useState<'login' | 'registro'>('registro');

  return (
    <AuthLayout>
      <h2 className="auth-form__titulo">
        {modo === 'login' ? 'Inicia sesion' : 'Crea tu cuenta'}
      </h2>
      <AuthForm modo={modo} onCambiarModo={() => setModo(modo === 'login' ? 'registro' : 'login')} />
    </AuthLayout>
  );
}
