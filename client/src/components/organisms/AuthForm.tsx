/**
 * ORGANISMO: AuthForm
 * ---------------------------------------------------------------------------
 * Un solo componente para login y registro. Se decide con `modo`, y las
 * diferencias son declarativas (que campos se muestran) en lugar de tener dos
 * formularios duplicados.
 *
 * Motivo: dos formularios paralelos se desincronizan. El dia que se cambie una
 * regla de validacion, es facil olvidar aplicarla en el otro.
 *
 * ---------------------------------------------------------------------------
 * VALIDACION EN DOS CAPAS
 * ---------------------------------------------------------------------------
 *   1. Aqui: validacion de EXPERIENCIA. Da feedback inmediato, sin gastar un
 *      viaje al servidor.
 *   2. En el servidor (Zod): validacion de SEGURIDAD. Es la unica que cuenta.
 *      La del cliente es solo cortesia y se puede saltarse desde la consola.
 * Ninguna duplica trabajo: cada capa cubre lo que la otra no puede.
 */
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../services/api';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';

type Modo = 'login' | 'registro';

interface AuthFormProps {
  modo: Modo;
  onCambiarModo: () => void;
}

export function AuthForm({ modo, onCambiarModo }: AuthFormProps) {
  const { iniciarSesion, registrar } = useAuth();
  const esRegistro = modo === 'registro';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({});
  // Mostrar la contrasena es una decision de la interfaz, no del formulario:
  // el valor sigue siendo el mismo, solo cambia como se representa.
  const [verPassword, setVerPassword] = useState(false);

  /** Valida en el cliente. Devuelve un objeto de errores (vacio si todo bien). */
  function validar(): Record<string, string> {
    const errores: Record<string, string> = {};

    if (esRegistro && fullName.trim().length === 0) {
      errores.fullName = 'El nombre completo es obligatorio';
    }
    // El navegador ya valida el formato del correo con type="email", pero se
    // revisa igual para el caso de un correo pegado con espacios.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errores.email = 'El correo no tiene un formato valido';
    }
    if (password.length < 8) {
      errores.password = 'La contrasena debe tener al menos 8 caracteres';
    }
    // Solo en registro tiene sentido comparar. En login no existe un campo
    // de confirmacion, y exigirlo alli seria un error de diseño.
    if (esRegistro && password !== passwordConfirm) {
      errores.passwordConfirm = 'Las contrasenas no coinciden';
    }

    return errores;
  }

  async function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    const erroresLocales = validar();
    setErroresCampo(erroresLocales);
    if (Object.keys(erroresLocales).length > 0) {
      return; // No se molesta al servidor si ya se sabe que esta mal.
    }

    setEnviando(true);
    try {
      if (esRegistro) {
        await registrar(fullName, email, password, passwordConfirm);
      } else {
        await iniciarSesion(email, password);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        // Si el servidor detallo errores por campo, se muestran junto al input.
        if (e.errors) {
          setErroresCampo(e.errors);
        } else {
          setError(e.message);
        }
      } else {
        setError('No se pudo conectar con el servidor.');
      }
    } finally {
      // finally se ejecuta tanto si hay exito como si hay fallo. Sin el, un
      // error dejaria el boton bloqueado para siempre.
      setEnviando(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={manejarEnvio} noValidate>
      {error ? (
        <div className="alerta alerta--error" role="alert">
          {error}
        </div>
      ) : null}

      {esRegistro ? (
        <FormField
          id="fullName"
          name="fullName"
          label="Nombre completo"
          value={fullName}
          onChange={setFullName}
          autoComplete="name"
          error={erroresCampo.fullName}
          disabled={enviando}
        />
      ) : null}

      <FormField
        id="email"
        name="email"
        label="Correo electronico"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        error={erroresCampo.email}
        disabled={enviando}
      />

      <FormField
        id="password"
        name="password"
        label="Contrasena"
        type={verPassword ? 'text' : 'password'}
        value={password}
        onChange={setPassword}
        autoComplete={esRegistro ? 'new-password' : 'current-password'}
        error={erroresCampo.password}
        disabled={enviando}
        accion={
          <button
            type="button"
            className="field-action"
            onClick={() => setVerPassword((v) => !v)}
            // El nombre accesible cambia con el estado: un lector de pantalla
            // anuncia la accion que se va a ejecutar, no el estado actual.
            aria-label={verPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
          >
            {verPassword ? 'Ocultar' : 'Ver'}
          </button>
        }
      />

      {esRegistro ? (
        <FormField
          id="passwordConfirm"
          name="passwordConfirm"
          label="Confirmar contrasena"
          type="password"
          value={passwordConfirm}
          onChange={setPasswordConfirm}
          autoComplete="new-password"
          error={erroresCampo.passwordConfirm}
          disabled={enviando}
        />
      ) : null}

      {/*
        El boton separa la etiqueta de la flecha con justify-content: space-
        between, de modo que la flecha queda en el extremo derecho. Es el mismo
        recurso que usa la barra del dashboard.
      */}
      <Button type="submit" fullWidth disabled={enviando}>
        <span className="btn__texto">
          {enviando ? 'Procesando...' : esRegistro ? 'Crear cuenta' : 'Iniciar sesion'}
        </span>
        <span aria-hidden="true">→</span>
      </Button>

      <p className="switch-copy">
        {esRegistro ? 'Ya tienes cuenta?' : 'No tienes cuenta?'}{' '}
        <button type="button" className="enlace" onClick={onCambiarModo}>
          {esRegistro ? 'Inicia sesion' : 'Registrate'}
        </button>
      </p>
    </form>
  );
}
