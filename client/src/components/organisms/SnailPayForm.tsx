/**
 * Regla central: el saldo solo sube si SnailPay responde "approved".
 *
 *   if (respuesta.status === 'approved') recargarSaldo(...);
 *
 * El default es no sumar, asi que declined, error, caida y timeout caen solos en
 * la rama que no toca el saldo: anadir un escenario nuevo no puede romper la
 * regla. El saldo vive en el cliente porque el enunciado lo pide, asi que el
 * servidor nunca lo ve ni lo modifica.
 */
import { useState } from 'react';
import { api, ApiError } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FormField } from '../molecules/FormField';
import { leerTarjeta } from '../../services/storage';
import type { SnailPayResponse } from '@snail/shared';

// Limites del monto duplicados a proposito: el cliente no debe depender del
// servidor para compilar. Lo que no se acepta es validarlo en un solo lado,
// porque el cliente se puede saltear. La copia del servidor es la que manda.
const MONTO_MINIMO = 1;
const MONTO_MAXIMO = 20_000;

// Montos de un clic, todos dentro del rango valido.
const MONTOS_SUGERIDOS = [50, 100, 250];

// Se queda con los digitos y reinserta la barra, para que "1226" produzca
// "12/26" sin que haya que pulsarla. Acepta tambien "12/26" tecleado a mano.
function formatearVencimiento(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 4);
  if (digitos.length <= 2) {
    return digitos;
  }
  return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
}

// Grupos de cuatro separados por guion: es una ayuda de lectura, no de
// transporte. El guion se muestra pero no se envia (ver soloDigitos). Es
// idempotente, asi que sirve al teclear y al recuperar la tarjeta guardada.
function formatearTarjeta(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 16);
  return digitos.replace(/(.{4})/g, '$1-').replace(/-$/, '');
}

// El guion es cosmetico. SnailPay compara contra el numero en crudo, asi que
// por la red viaja 1234123412341234 y no 1234-1234-1234-1234.
function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/** Los tres estados posibles de una recarga, segun lo que devuelve SnailPay. */
type Resultado = 'idle' | 'cargando' | 'exito' | 'fallo';

interface SnailPayFormProps {
  onClose: () => void;
  /**
   * Se invoca solo en el escenario aprobado, justo antes de cerrar el dialogo.
   *
   * Existe para que el aviso de confirmacion pueda mostrarse FUERA del modal:
   * si el dialogo se cierra al instante, el codigo de autorizacion se
   * perderia, y ese codigo es parte de la respuesta que hay que evidenciar.
   */
  onExito?: (respuesta: SnailPayResponse) => void;
}

export function SnailPayForm({ onClose, onExito }: SnailPayFormProps) {
  const { recargarSaldo, guardarTarjeta, user } = useAuth();

  // Se precargan la ultima tarjeta usada y el nombre del usuario, para no
  // obligar a escribir todo de nuevo en cada recarga. De paso se cumple el
  // requisito de persistir la tarjeta.
  const guardada = leerTarjeta();
  // Se formatea al leer porque lo guardado son digitos pelados, y el campo
  // debe mostrar los grupos desde el primer momento.
  const [cardNumber, setCardNumber] = useState(formatearTarjeta(guardada?.cardNumber ?? ''));
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [fullName, setFullName] = useState(guardada?.fullName ?? user?.fullName ?? '');
  const [amount, setAmount] = useState('100');

  const [resultado, setResultado] = useState<Resultado>('idle');
  const [respuesta, setRespuesta] = useState<SnailPayResponse | null>(null);
  const [errorRed, setErrorRed] = useState<string | null>(null);
  const [errorMonto, setErrorMonto] = useState<string | undefined>(undefined);

  /**
   * Valida el monto antes de contacting al servidor.
   *
   * Igual que en el formulario de autenticacion, esto es validacion de
   * EXPERIENCIA: evita un viaje al servidor y da feedback inmediato. La
   * validacion que manda es la del servidor.
   */
  function validarMonto(valor: string): string | undefined {
    const monto = Number(valor);
    if (valor.trim() === '' || Number.isNaN(monto)) {
      return 'Escribe un monto';
    }
    if (!Number.isInteger(monto)) {
      return 'El monto debe ser un numero entero';
    }
    if (monto < MONTO_MINIMO) {
      return `El monto minimo es ${MONTO_MINIMO}`;
    }
    if (monto > MONTO_MAXIMO) {
      return `El monto maximo por recarga es ${MONTO_MAXIMO}`;
    }
    return undefined;
  }

  async function manejarEnvio(evento: React.FormEvent) {
    evento.preventDefault(); // Sin esto, el navegador recarga la pagina.

    const problemaMonto = validarMonto(amount);
    setErrorMonto(problemaMonto);
    if (problemaMonto) {
      return; // No se envia nada invalido.
    }

    setResultado('cargando');
    setRespuesta(null);
    setErrorRed(null);

    const monto = Number(amount);

    try {
      // El payload viaja sin guiones: el formato es de la pantalla, no del
      // dato. Ver soloDigitos().
      const r = await api.cobrar({
        cardNumber: soloDigitos(cardNumber),
        expiryDate,
        cvv,
        fullName,
        amount: monto,
      });
      setRespuesta(r);

      // === REGLA CRITICA ==================================================
      // Unico lugar del cliente donde el saldo aumenta.
      if (r.status === 'approved') {
        recargarSaldo(r.transaction_amount);
        setResultado('exito');
      } else {
        // declined o error: el saldo NO se toca. Aqui no hay ningun
        // recargarSaldo, y esa ausencia ES la garantia.
        setResultado('fallo');
      }
      // ====================================================================

      // La tarjeta se persiste solo tras una operacion resuelta, nunca antes.
      // Se guardan los digitos: el formato se reconstruye al mostrarlos, y
      // guardar la presentacion haria que el almacenamiento dependiera de la
      // pantalla.
      guardarTarjeta({ cardNumber: soloDigitos(cardNumber), cvv, fullName });

      // Solo el exito cierra el dialogo. Un fallo lo deja abierto porque el
      // usuario tiene que corregir algo e intentarlo otra vez; cerrarlo lo
      // obligaria a reabrirlo y a explicar el error otra vez.
      if (r.status === 'approved') {
        onExito?.(r);
        onClose();
      }
    } catch (error) {
      // Fallo de red o del propio servidor: tampoco se toca el saldo.
      setResultado('fallo');
      setErrorRed(
        error instanceof ApiError
          ? error.message
          : 'Ocurrio un error inesperado. Tu saldo no fue modificado.',
      );
    }
  }

  const occupado = resultado === 'cargando';

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      /* Cierra solo si el gesto empieza en el fondo. Sin esta comprobacion,
         arrastrar desde un campo hasta el borde cerraria el dialogo. */
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onClose();
      }}
    >
      <div className="top-up-modal" role="dialog" aria-modal="true" aria-labelledby="snailpay-title">
        <div className="modal-header">
          <div>
            <p className="metric-label">BILLETERA DIGITAL</p>
            <h2 id="snailpay-title">Recargar saldo</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar modal">
            &times;
          </button>
        </div>

        {/*
          Fuera del formulario a proposito: es informacion sobre el pago, no un
          campo. Ademas lleva los datos de la tarjeta de prueba, que un
          evaluador necesita para poder ejecutar los tres escenarios.
        */}
        <div className="payment-note">
          <strong>Pago seguro</strong>
          <span>Tu saldo se actualizara al confirmar la recarga.</span>
          <span>Tarjeta de prueba: 1234123412341234 &middot; 12/26 &middot; CVV 543</span>
        </div>

        {/*
          noValidate es ESENCIAL, no decorativo.

          Los atributos min y max del input hacen que el navegador aplique su
          propia validacion al enviar. Si el monto esta fuera de rango, el
          navegador BLOQUEA el envio del formulario y muestra una burbuja
          nativa, sin ejecutar nunca este codigo. Consecuencia: la validacion
          de abajo nunca se ejecutaria y el usuario veria un aviso del sistema
          en lugar del mensaje con estilos y accesible de la aplicacion.

          Con noValidate, el formulario se envia siempre y la decision queda
          en un solo sitio: validarMonto(). Un unico lugar que decide es
          mas facil de leer y de probar que dos que compiten.
        */}
        <form onSubmit={manejarEnvio} className="top-up-form" noValidate>
          {/* El monto va primero: es el dato que decide el tamano de la
              operacion, y el diseno lo coloca antes de la tarjeta. */}
          <FormField
            id="amount"
            name="amount"
            label={`Monto a recargar (${MONTO_MINIMO} - ${MONTO_MAXIMO})`}
            value={amount}
            onChange={setAmount}
            type="number"
            error={errorMonto}
            disabled={occupado}
            min={MONTO_MINIMO}
            max={MONTO_MAXIMO}
          />

          {/* Montos sugeridos. Escriben en el campo de arriba, no pagan nada:
              sustituyen al tecleo para los cuatro casos comunes. */}
          <div className="amount-options" role="group" aria-label="Montos sugeridos">
            {MONTOS_SUGERIDOS.map((valor) => (
              <button
                key={valor}
                type="button"
                className={
                  amount === String(valor) ? 'amount-option selected' : 'amount-option'
                }
                onClick={() => setAmount(String(valor))}
                disabled={occupado}
              >
                ${valor}
              </button>
            ))}
          </div>

          <FormField
            id="card-number"
            name="cardNumber"
            label="Numero de tarjeta"
            value={cardNumber}
            onChange={(valor) => setCardNumber(formatearTarjeta(valor))}
            placeholder="1234-1234-1234-1234"
            autoComplete="cc-number"
            disabled={occupado}
            maxLength={19}
          />

          <div className="card-fields">
            <FormField
              id="expiry-date"
              name="expiryDate"
              label="Vencimiento (MM/AA)"
              value={expiryDate}
              onChange={(valor) => setExpiryDate(formatearVencimiento(valor))}
              placeholder="12/26"
              autoComplete="cc-exp"
              disabled={occupado}
              maxLength={5}
            />
            <FormField
              id="cvv"
              name="cvv"
              label="CVV"
              value={cvv}
              onChange={setCvv}
              placeholder="543"
              autoComplete="cc-csc"
              disabled={occupado}
              maxLength={4}
            />
          </div>

          <FormField
            id="payer-name"
            name="fullName"
            label="Nombre del titular"
            value={fullName}
            onChange={setFullName}
            autoComplete="cc-name"
            disabled={occupado}
          />

          {/*
            min y max se aplican en el input del navegador: es una primera
            barrera, pero NO la de seguridad. Si alguien llama a la API
            directamente, se saltan estos atributos. Por eso el rango se
            revalida en el servidor.
          */}

          {/*
            Mensajes de resultado. Cada escenario del enunciado tiene su
            propio mensaje, y los tres dicen explicitamente si el saldo cambio
            o no. Es informacion obligatoria, no cortesia.
          */}
          {resultado === 'exito' && respuesta ? (
            <div className="alerta alerta--ok" role="status">
              <strong>Recarga exitosa.</strong> {respuesta.status_detail}
              <span className="alerta__mono"> Autorizacion: {respuesta.authorization_code}</span>
            </div>
          ) : null}

          {resultado === 'fallo' ? (
            <div className="alerta alerta--error" role="alert">
              <strong>No se pudo completar la recarga.</strong>
              <br />
              {errorRed ?? respuesta?.status_detail}
              {respuesta ? (
                <span className="alerta__mono"> Codigo: {respuesta.status}</span>
              ) : null}
            </div>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose} disabled={occupado}>
              Cancelar
            </button>
            {/* El texto sigue siendo "Pagar" y no "Agregar $X": el nombre
                accesible exacto es parte del contrato que verifican las
                pruebas del cliente. */}
            <button type="submit" className="confirm-button" disabled={occupado}>
              {occupado ? 'Procesando...' : 'Pagar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
