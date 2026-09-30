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
  const esLogin = modo === 'login';

  return (
    <AuthLayout
      eyebrow={esLogin ? 'BIENVENIDO DE VUELTA' : 'NUEVO PARTICIPANTE'}
      titulo={esLogin ? 'Inicia sesion' : 'Crea tu cuenta'}
      intro={esLogin ? 'Continua donde lo dejaste.' : 'Empieza a registrar tu ritmo.'}
    >
      <AuthForm modo={modo} onCambiarModo={() => setModo(esLogin ? 'registro' : 'login')} />
    </AuthLayout>
  );
}
