/**
 * SnailPay: pasarela simulada. Tres escenarios, con numeros de tarjeta
 * deterministas para poder reproducirlos:
 *
 *   1234123412341234  aprobado (lo exige el enunciado)
 *   4000000000000002  tarjeta rechazada
 *   0000000000000000  caida del sistema
 *
 * Mientras la pasarela esta caida no se aprueba nada, ni con la tarjeta buena.
 *
 * Dos avisos sobre esto:
 *   - Si la operacion falla, el saldo no se toca. Este servicio nunca devuelve
 *     un cobro exitoso falso ni un authorization_code en un rechazo.
 *   - Devolver tarjeta y CVV, y guardarlos en el cliente, es inseguro: en un
 *     sistema real jamas volverian al navegador. Se hace porque el enunciado lo
 *     pide, y el riesgo queda anotado aqui a proposito.
 */
import { randomUUID } from 'node:crypto';
import type { SnailPayChargeRequest, SnailPayResponse } from '@snail/shared';

// Tarjetas de prueba
export const TARJETA_EXITO = '1234123412341234';
export const VENCIMIENTO_EXITO = '12/26';
export const CVV_EXITO = '543';

export const TARJETA_RECHAZADA = '4000000000000002';
export const TARJETA_CAIDA_SISTEMA = '0000000000000000';

// Limites del monto

/** Recarga minima y maxima admitidas. */
export const MONTO_MINIMO = 1;
export const MONTO_MAXIMO = 20_000;

/*
 * El techo existe por un bug real: la validacion original solo comprobaba que
 * el monto fuera mayor que cero, asi que teclear un numero de tarjeta en el
 * campo de monto aprobo una recarga de 4 billones. El monto es dinero, y el
 * unico criterio "positivo" aceptaba cualquier numero absurdo. Ademas el rango
 * se valida en el servidor, que es la unica frontera confiable.
 */

// Codigos de resultado
// CODIGO_APROBADO es el unico que se emite como authorization_code, y solo en
// un cobro exitoso. Los rechazos y las caidas de sistema devuelven null.
export const CODIGO_APROBADO = 'SNP-OK';

/**
 * Estado de la pasarela.
 *
 * Es mutable a proposito: es lo que permite simular una caida del sistema y
 * restaurarla despues, que es lo que exige el escenario 3.
 */
const pasarela = {
  enCaida: false,
};

/** Activa el escenario de error del sistema (util para pruebas manuales). */
export function activarCaidaSistema(): void {
  pasarela.enCaida = true;
}

/** Restaura el servicio a su estado normal. */
export function desactivarCaidaSistema(): void {
  pasarela.enCaida = false;
}

export function estadoPasarela(): { enCaida: boolean } {
  return { enCaida: pasarela.enCaida };
}

/**
 * Construye la respuesta con TODOS los campos del contrato.
 *
 * Se centraliza en un solo lugar para garantizar que ningun escenario
 * responda con un formato distinto: si el cliente espera 9 campos, siempre
 * llegan 9.
 */
function construirRespuesta(
  estado: SnailPayResponse['status'],
  detalle: string,
  datos: SnailPayChargeRequest,
  codigoAutorizacion: string | null,
): SnailPayResponse {
  return {
    id: randomUUID(),
    status: estado,
    status_detail: detalle,
    transaction_amount: datos.amount,
    date_created: new Date().toISOString(),
    authorization_code: codigoAutorizacion,
    reference: `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    payer_id: datos.payer_id,
    payer_email: datos.payer_email,
    // El enunciado exige devolverlos. Ver la nota de seguridad del encabezado.
    cardNumber: datos.cardNumber,
    cvv: datos.cvv,
  };
}

// El numero se teclea y se pega con guiones o espacios. Comparar la cadena tal
// cual rechazaria una tarjeta correcta solo por su formato. Se normaliza aqui y
// no solo en el cliente porque el cliente no es una frontera confiable.
function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/**
 * Procesa un cobro. No modifica ningun saldo: el saldo vive en el cliente y es
 * el cliente quien lo aplica solo si status es "approved".
 */
export function cobrar(datos: SnailPayChargeRequest): SnailPayResponse {
  const tarjeta = soloDigitos(datos.cardNumber);

  // Escenario 3: error del sistema
  // Se evalua PRIMERO, antes de validar nada. Si la pasarela esta caida, no
  // importa que los datos sean correctos: no se procesa ninguna solicitud.
  const hayCaidaForzada = pasarela.enCaida;
  const esTarjetaCaida = tarjeta === TARJETA_CAIDA_SISTEMA;
  if (hayCaidaForzada || esTarjetaCaida) {
    return construirRespuesta(
      'error',
      'SnailPay no esta disponible en este momento. Tu saldo no fue modificado. Intenta de nuevo mas tarde.',
      datos,
      null,
    );
  }

  // Validaciones de entrada
  // Se comprueban antes de emitir ningun codigo de autorizacion. Una tarjeta
  // valida con un monto invalido no es un cobro: es un error de entrada.
  // El orden importa: primero se descarta lo que no es un numero, porque
  // comparar NaN con cualquier valor da false y se saltaria la validacion.
  if (typeof datos.amount !== 'number' || !Number.isFinite(datos.amount)) {
    return construirRespuesta(
      'declined',
      'El monto no es un numero valido. Tu saldo no fue modificado.',
      datos,
      null,
    );
  }

  // Se valida como RANGO cerrado, no solo como positivo. El techo es lo que
  // impide que un numero tecleado por error se convierta en una recarga real.
  if (!Number.isInteger(datos.amount)) {
    return construirRespuesta(
      'declined',
      'El monto debe ser un numero entero. Tu saldo no fue modificado.',
      datos,
      null,
    );
  }

  if (datos.amount < MONTO_MINIMO) {
    return construirRespuesta(
      'declined',
      `El monto minimo es ${MONTO_MINIMO}. Tu saldo no fue modificado.`,
      datos,
      null,
    );
  }

  if (datos.amount > MONTO_MAXIMO) {
    return construirRespuesta(
      'declined',
      `El monto maximo por recarga es ${MONTO_MAXIMO}. Tu saldo no fue modificado.`,
      datos,
      null,
    );
  }

  if (datos.fullName.trim().length === 0) {
    return construirRespuesta(
      'declined',
      'El nombre completo es obligatorio. Tu saldo no fue modificado.',
      datos,
      null,
    );
  }

  if (datos.cvv.length !== 3) {
    return construirRespuesta(
      'declined',
      'El CVV debe tener 3 digitos. Tu saldo no fue modificado.',
      datos,
      null,
    );
  }

  if (!/^\d{2}\/\d{2}$/.test(datos.expiryDate)) {
    return construirRespuesta(
      'declined',
      'La fecha de vencimiento debe tener el formato MM/AA. Tu saldo no fue modificado.',
      datos,
      null,
    );
  }

  // Escenario 1: cobro exitoso
  // Solo se llega aqui con todos los requisitos del enunciado cumplidos:
  // tarjeta 1234123412341234, vencimiento 12/26, CVV 543, nombre no vacio y
  // monto mayor que cero.
  if (
    tarjeta === TARJETA_EXITO &&
    datos.expiryDate === VENCIMIENTO_EXITO &&
    datos.cvv === CVV_EXITO
  ) {
    return construirRespuesta(
      'approved',
      'Operacion aprobada. Tu saldo fue actualizado correctamente.',
      datos,
      CODIGO_APROBADO,
    );
  }

  // Escenario 2: error de transaccion
  // Cualquier otra combinacion valida se rechaza. El detalle va en status_detail
  // para que el usuario sepa que corregir, sin revelar reglas internas.
  //
  // authorization_code queda en null a proposito: significa "hubo un cargo", y
  // emitirlo en un rechazo permitiria que un cliente sumara un cobro inexistente.
  return construirRespuesta(
    'declined',
    'La tarjeta fue rechazada por el emisor. Verifica los datos e intenta de nuevo. Tu saldo no fue modificado.',
    datos,
    null,
  );
}
