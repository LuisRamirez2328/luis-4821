/**
 * Los tres escenarios del enunciado, y sobre todo la regla de que un fallo no
 * modifica el saldo.
 *
 * El saldo vive en el cliente y el servidor nunca lo toca, asi que lo que se
 * comprueba aqui es que la respuesta nunca indique un cobro aprobado cuando en
 * realidad fallo: es lo unico que podria hacer que un cliente bien escrito
 * sumara saldo por error.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  cobrar,
  activarCaidaSistema,
  desactivarCaidaSistema,
  TARJETA_EXITO,
  VENCIMIENTO_EXITO,
  CVV_EXITO,
  MONTO_MINIMO,
  MONTO_MAXIMO,
} from '../services/snailPayService.js';
import type { SnailPayChargeRequest } from '@snail/shared';

/** Datos base de una solicitud valida. */
function solicitudValida(overrides: Partial<SnailPayChargeRequest> = {}): SnailPayChargeRequest {
  return {
    cardNumber: TARJETA_EXITO,
    expiryDate: VENCIMIENTO_EXITO,
    cvv: CVV_EXITO,
    fullName: 'Luis Ramirez',
    amount: 100,
    payer_id: 'user-123',
    payer_email: 'luis@ejemplo.com',
    ...overrides,
  };
}

// La caida del sistema es estado global del modulo. Hay que restaurarla o
// contaminaria las pruebas siguientes.
beforeEach(() => {
  desactivarCaidaSistema();
});

describe('SnailPay - escenario 1: cobro exitoso', () => {
  it('aprueba la tarjeta de prueba definida por el enunciado', () => {
    const r = cobrar(solicitudValida());
    expect(r.status).toBe('approved');
    expect(r.authorization_code).toBeTruthy();
  });

  it('incluye los 9 campos del contrato mas tarjeta y CVV', () => {
    const r = cobrar(solicitudValida());
    // El enunciado enumera estos campos de forma explicita.
    for (const campo of [
      'id',
      'status',
      'status_detail',
      'transaction_amount',
      'date_created',
      'authorization_code',
      'reference',
      'payer_id',
      'payer_email',
      'cardNumber',
      'cvv',
    ]) {
      expect(r).toHaveProperty(campo);
    }
  });

  it('devuelve exactamente el monto cobrado', () => {
    const r = cobrar(solicitudValida({ amount: 250 }));
    expect(r.transaction_amount).toBe(250);
  });
});

describe('SnailPay - escenario 2: error de transaccion', () => {
  it('rechaza una tarjeta distinta a la de prueba', () => {
    const r = cobrar(solicitudValida({ cardNumber: '4000000000000002' }));
    expect(r.status).toBe('declined');
    expect(r.authorization_code).toBeNull();
  });

  /*
   * Formato de entrada, no de tarjeta.
   * ------------------------------------------------------------------------
   * El numero se teclea y se pega con guiones o espacios todo el tiempo. Si la
   * comparacion fuera por cadena exacta, "1234-1234-1234-1234" seria rechazada
   * aunque los digitos sean los correctos, que es un fallo desconcertante para
   * quien lo ve. El servidor normaliza porque es la unica frontera confiable.
   */
  it('acepta la tarjeta de exito aunque venga con guiones o espacios', () => {
    const conGuiones = cobrar(solicitudValida({ cardNumber: '1234-1234-1234-1234' }));
    expect(conGuiones.status).toBe('approved');

    const conEspacios = cobrar(solicitudValida({ cardNumber: '1234 1234 1234 1234' }));
    expect(conEspacios.status).toBe('approved');
  });

  it('sigue rechazando la tarjeta de rechazo aunque venga formateada', () => {
    const r = cobrar(solicitudValida({ cardNumber: '4000-0000-0000-0002' }));
    expect(r.status).toBe('declined');
    expect(r.authorization_code).toBeNull();
  });

  it('detecta la caida del sistema aunque la tarjeta venga formateada', () => {
    const r = cobrar(solicitudValida({ cardNumber: '0000-0000-0000-0000' }));
    expect(r.status).toBe('error');
  });

  it('rechaza un monto cero o negativo', () => {
    expect(cobrar(solicitudValida({ amount: 0 })).status).toBe('declined');
    expect(cobrar(solicitudValida({ amount: -50 })).status).toBe('declined');
  });

  it('rechaza un CVV con longitud incorrecta', () => {
    const r = cobrar(solicitudValida({ cvv: '54' }));
    expect(r.status).toBe('declined');
  });

  it('rechaza un numero de tarjeta en el campo de monto', () => {
    // BUG REAL detectado en prueba manual: al teclear 4000000000000002 en el
    // campo de monto, la validacion original solo comprobaba "mayor que cero",
    // asi que aprobo una recarga de 4 billones. Estas pruebas existen para que
    // no vuelva a pasar.
    const r = cobrar(solicitudValida({ amount: 4_000_000_000_000_002 }));
    expect(r.status).toBe('declined');
    expect(r.authorization_code).toBeNull();
  });

  it('rechaza cualquier monto por encima del maximo', () => {
    expect(cobrar(solicitudValida({ amount: MONTO_MAXIMO + 1 })).status).toBe('declined');
    expect(cobrar(solicitudValida({ amount: 999_999 })).status).toBe('declined');
  });

  it('acepta un monto exactamente igual al maximo', () => {
    // El limite es inclusivo: el maximo debe poder usarse.
    expect(cobrar(solicitudValida({ amount: MONTO_MAXIMO })).status).toBe('approved');
  });

  it('rechaza montos por debajo del minimo', () => {
    expect(cobrar(solicitudValida({ amount: MONTO_MINIMO - 1 })).status).toBe('declined');
  });

  it('rechaza montos decimales', () => {
    // Un monto con centavos no tiene sentido en esta simulacion, y admitirlos
    // abriria la puerta a errores de redondeo al sumar al saldo.
    expect(cobrar(solicitudValida({ amount: 10.5 })).status).toBe('declined');
  });

  it('rechaza montos no finitos', () => {
    expect(cobrar(solicitudValida({ amount: Number.POSITIVE_INFINITY })).status).toBe('declined');
    expect(cobrar(solicitudValida({ amount: Number.NaN })).status).toBe('declined');
  });

  it('rechaza un nombre vacio', () => {
    const r = cobrar(solicitudValida({ fullName: '   ' }));
    expect(r.status).toBe('declined');
  });
});

describe('SnailPay - escenario 3: error del sistema', () => {
  it('devuelve status "error" cuando el servicio esta caido', () => {
    activarCaidaSistema();
    const r = cobrar(solicitudValida());
    expect(r.status).toBe('error');
    expect(r.authorization_code).toBeNull();
  });

  it('rechaza incluso la tarjeta valida si el servicio esta caido', () => {
    activarCaidaSistema();
    // Aunque los datos sean correctos, un servicio caido no procesa cobros.
    // Aprobar aqui seria mentirle al cliente sobre su dinero.
    expect(cobrar(solicitudValida()).status).not.toBe('approved');
  });

  it('vuelve a aprobar una vez restaurado el servicio', () => {
    activarCaidaSistema();
    expect(cobrar(solicitudValida()).status).toBe('error');
    desactivarCaidaSistema();
    expect(cobrar(solicitudValida()).status).toBe('approved');
  });
});

describe('SnailPay - regla critica: fallo nunca modifica el saldo', () => {
  it('ningun escenario fallido devuelve un cobro aprobado', () => {
    const casosFallidos = [
      { name: 'tarjeta rechazada', datos: solicitudValida({ cardNumber: '4000000000000002' }) },
      { name: 'monto cero', datos: solicitudValida({ amount: 0 }) },
      { name: 'monto negativo', datos: solicitudValida({ amount: -10 }) },
      { name: 'cvv invalido', datos: solicitudValida({ cvv: '1' }) },
      { name: 'nombre vacio', datos: solicitudValida({ fullName: '' }) },
      { name: 'expiracion invalida', datos: solicitudValida({ expiryDate: '2026-12' }) },
      // Los tres casos que faltaban yovascularon el bug del monto sin techo.
      // Los tres casos que faltaban y que dejaron pasar el bug del monto sin techo.
      { name: 'monto enorme', datos: solicitudValida({ amount: 4_000_000_000_000_002 }) },
      { name: 'monto decimal', datos: solicitudValida({ amount: 10.5 }) },
      { name: 'monto infinito', datos: solicitudValida({ amount: Number.POSITIVE_INFINITY }) },
    ];

    for (const caso of casosFallidos) {
      const r = cobrar(caso.datos);
      // El cliente solo suma saldo cuando status === "approved". Por eso esta
      // es la garantia real de que el saldo no se altera en un fallo.
      expect(r.status, `caso: ${caso.name}`).not.toBe('approved');
    }
  });

  it('ningun fallo emite codigo de autorizacion', () => {
    // Un authorization_code implica que hubo un cargo. Si aparece en un fallo,
    // un cliente mal hecho podria contabilizarlo.
    const r = cobrar(solicitudValida({ cardNumber: '4000000000000002' }));
    expect(r.authorization_code).toBeNull();
  });
});
