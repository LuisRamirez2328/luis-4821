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
