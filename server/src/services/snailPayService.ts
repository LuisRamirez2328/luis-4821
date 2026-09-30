/**
 * SERVICIO SNAILPAY (pasarela simulada)
 * ===========================================================================
 * Este modulo es el corazon de la prueba. El enunciado exige tres escenarios
 * y una serie de reglas que no se pueden romper.
 *
 * ---------------------------------------------------------------------------
 * TARJETAS DE PRUEBA
 * ---------------------------------------------------------------------------
 * Se sigue la convencion habitual de pasarelas reales (tarjetas de prueba):
 * una tarjeta valida y numero de tarjeta deterministas significan "aprobada".
 * Asi la operacion es 100% reproducible, que es lo que pide el enunciado.
 *
 *   1234123412341234  -> cobro EXITOSO   (exigido por el enunciado)
 *   4000000000000002  -> tarjeta RECHAZADA (error de transaccion)
 *   0000000000000000  -> CAIDA DEL SISTEMA (error de sistema, documentado)
 *
 * La ultima es la "forma documentada" que el enunciado pide para simular que
 * SnailPay no puede procesar solicitudes. Mientras este modo este activo,
 * NINGUNA recarga se aprueba, ni siquiera con la tarjeta buena.
 *
 * ---------------------------------------------------------------------------
 * REGLAS INVIOLABLES
 * ---------------------------------------------------------------------------
 *   1. Si la operacion falla, el saldo NO se modifica.
 *   2. Nunca devolver un cobro exitoso falso.
 *   3. La respuesta incluye siempre los 9 campos del contrato, mas numero de
 *      tarjeta y CVV (el enunciado los exige de forma explicita).
 *   4. El monto se valida en un RANGO, no solo como positivo. Ver la nota de
 *      seguridad de límites más abajo: es un bug real que se detectó durante
 *      las pruebas manuales.
 *
 * ---------------------------------------------------------------------------
 * NOTA SOBRE SEGURIDAD
 * ---------------------------------------------------------------------------
 * Devolver numero de tarjeta y CVV en la respuesta es una practica insegura:
 * en un sistema real esos datos jamas volverian al cliente. Aqui se incluye
 * porque el enunciado lo pide, y tiene sentido dentro del ejercicio: lo que
 * se simula es una pasarela de confianza, no un PSP real.
 *
 * Aun asi, el propio cliente guarda esos datos en LocalStorage, que es
 * accesible a cualquier script de la pagina (un XSS las leeria). En produccion
 * la mitigacion es no persistir el CVV nunca (los PCI DSS lo prohiben) y usar
 * un formulario alojado por el proveedor. Se documenta aqui para dejar clara
 * la consciousness de la limitacion.
 */
import { randomUUID } from 'node:crypto';
import type { SnailPayChargeRequest, SnailPayResponse } from '@snail/shared';

// --- Tarjetas de prueba -----------------------------------------------------
export const TARJETA_EXITO = '1234123412341234';
export const VENCIMIENTO_EXITO = '12/26';
export const CVV_EXITO = '543';

export const TARJETA_RECHAZADA = '4000000000000002';
export const TARJETA_CAIDA_SISTEMA = '0000000000000000';

// --- Limites del monto -------------------------------------------------------

/** Recarga minima y maxima admitidas. */
export const MONTO_MINIMO = 1;
export const MONTO_MAXIMO = 20_000;

/*
 * POR QUE EXISTE UN TECHO
 *
 * Bug real detectado durante la prueba manual: la validacion original solo
 * comprobaba que el monto fuera mayor que cero. Al teclear por error un numero
 * de tarjeta en el campo de monto, la pasarela aprobo una recarga de 4 billones
 * y el saldo quedo en esa cifra.
 *
 * El monto no es un entero cualquiera: es dinero. Sin un techo, un usuario
 * puede teclear un valor absurdo (un numero de tarjeta, un saldo equivocado) y
 * el sistema lo acepta como valido, porque el unico criterio era "positivo".
 *
 * Esto no es hipotetico: es exactamente lo que paso. Es el motivo de que la
 * validacion de un rango sea mas robusta que la de un simple "> 0", y de que
 * los limites de negocio se validen en el SERVIDOR, no solo en el formulario.
 */

// --- Codigos de resultado ---------------------------------------------------
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

/**
 * Procesa un cobro.
 *
 * @returns la respuesta de SnailPay. NO modifica ningun saldo: el saldo vive
 * en el cliente, y es el cliente quien debe aplicarlo solo si status es
 * "approved". Que la decision este del lado del cliente es justamente lo que
 * hace que un fallo nunca pueda alterar el saldo.
 */
/**
 * Deja la tarjeta en solo digitos.
 *
 * El numero de tarjeta se pega y se teclea con guiones o espacios con mucha
 * frecuencia (los grupos de cuatro son como lo muestra cualquier formulario).
 * Comparar la cadena tal cual rechazaria una tarjeta correcta solo por su
 * formato, que es un fallo confuso: el usuario ve "tarjeta rechazada" cuando
 * los digitos son buenos.
 *
 * Se normaliza en el servidor y no solo en el cliente porque el cliente no es
 * una frontera confiable: cualquiera puede llamar a la API directamente.
 */
function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

export function cobrar(datos: SnailPayChargeRequest): SnailPayResponse {
  const tarjeta = soloDigitos(datos.cardNumber);

  // --- Escenario 3: error del sistema -------------------------------------
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

  // --- Validaciones de entrada --------------------------------------------
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

  // --- Escenario 1: cobro exitoso -----------------------------------------
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

  // --- Escenario 2: error de transaccion ----------------------------------
  // Cualquier otra combinacion valida se rechaza. El detalle se devuelve en
  // status_detail para que el usuario sepa que corregir, sin revelar reglas
  // internas de la pasarela.
  //
  // authorization_code queda en null a proposito: ese campo significa "hubo un
  // cargo". Emitirlo en un rechazo permitiria que un cliente contabilizara un
  // cobro que en realidad no ocurrio, y es exactamente el fallo que el
  // enunciado quiere evitar ("nunca devolver un cobro exitoso falso").
  return construirRespuesta(
    'declined',
    'La tarjeta fue rechazada por el emisor. Verifica los datos e intenta de nuevo. Tu saldo no fue modificado.',
    datos,
    null,
  );
}
