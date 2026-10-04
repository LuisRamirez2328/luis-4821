/**
 * PRUEBAS DEL LADO CLIENTE
 * ===========================================================================
 * Se prueban las tres piezas donde el enunciado pone condiciones concretas:
 *
 *   1. La REGLA CRITICA: un fallo de SnailPay no puede modificar el saldo.
 *      Se verifica sobre el componente real, no sobre logica copiada.
 *   2. Los porcentajes del anillo deben sumar 100 (si no, el grafico se deforma).
 *   3. La ruta protegida no debe renderizar el dashboard sin sesion.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { BetStatsPanel, calcularPorcentajes } from '../components/organisms/BetStatsPanel';
import { AppRoutes } from '../App';
import {
  guardarSaldo,
  leerSaldo,
  inicializarSaldo,
  guardarSesion,
  migrarSaldoGlobal,
} from '../services/storage';
import { api, ApiError } from '../services/api';
import type { SnailPayResponse } from '@snail/shared';

/**
 * Identificador del usuario de prueba.
 *
 * El saldo se guarda indexado por usuario, asi que todas las pruebas que lo
 * tocan pasan por el mismo id para hablar de la misma cuenta.
 */
const USUARIO_ID = 'u1';

beforeEach(() => {
  window.localStorage.clear();
  inicializarSaldo(USUARIO_ID);
  // Recharts mide el contenedor; sin esto da 0x0 y Recharts avisa por consola.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('calcularPorcentajes', () => {
  it('los porcentajes suman siempre 100', () => {
    // Se anotan como tuplas porque TypeScript, con la opcion
    // noUncheckedIndexedAccess, trataria los elementos de un array normal
    // como posiblemente indefinidos.
    const casos: Array<[number, number]> = [[1, 2], [1, 1], [2, 3], [5, 6], [1, 6], [0, 5]];
    for (const [w, l] of casos) {
      const { winPct, lossPct } = calcularPorcentajes(w, l);
      expect(winPct + lossPct, `${w}/${l}`).toBe(100);
    }
  });

  it('no divide entre cero cuando no hay datos', () => {
    const { winPct, lossPct } = calcularPorcentajes(0, 0);
    expect(winPct).toBe(0);
    expect(lossPct).toBe(0);
  });
});

describe('almacenamiento local', () => {
  it('el saldo arranca en 0', () => {
    expect(leerSaldo(USUARIO_ID)).toBe(0);
  });

  it('el saldo sobrevive a una recarga (se relee de LocalStorage)', () => {
    guardarSaldo(USUARIO_ID, 750);
    // Simula el F5: una lectura nueva del mismo almacenamiento.
    expect(leerSaldo(USUARIO_ID)).toBe(750);
  });

  /*
   * ---------------------------------------------------------------------------
   * AISLAMIENTO ENTRE CUENTAS
   * ---------------------------------------------------------------------------
   * Estas dos pruebas fijan un defecto real. El saldo se guardaba en una clave
   * unica ('snail.saldo') para toda la aplicacion, de modo que dos cuentas
   * distintas abiertas en el mismo navegador compartian la misma billetera.
   * Con la clave por usuario, cada cuenta ve solo su dinero.
   */
  it('dos cuentas en el mismo navegador NO comparten saldo', () => {
    guardarSaldo('u1', 5_000);
    guardarSaldo('u2', 250);

    expect(leerSaldo('u1')).toBe(5_000);
    expect(leerSaldo('u2')).toBe(250);
  });

  it('el saldo de una cuenta es independiente del orden de entrada', () => {
    // El defecto se manifestaba al alternar entre cuentas: una tomaba el saldo
    // de la otra. Aqui se comprueba que el orden no altera nada.
    guardarSaldo('u1', 1_000);
    expect(leerSaldo('u2')).toBe(0);
    expect(leerSaldo('u1')).toBe(1_000);
  });

  /*
   * ---------------------------------------------------------------------------
   * SALDO NO CREDIBLE
   * ---------------------------------------------------------------------------
   * localStorage es editable a mano, asi que un valor leido de ahi no es un
   * dato fiable. Antes, leerSaldo solo comprobaba que el numero fuera finito, y
   * por eso un saldo de 4 billones se aceptaba como dinero real y se
   * resucitaba en cada inicio de sesion.
   */
  it('descarta un saldo absurdo en vez de mostrarlo como dinero', () => {
    guardarSaldo('u9', 4_000_000_000_000_702);
    expect(leerSaldo('u9')).toBe(1_000_000_000); // queda en el techo, no en el valor
  });

  it('descarta saldos negativos, decimales y valores no numericos', () => {
    guardarSaldo('neg', -500);
    expect(leerSaldo('neg')).toBe(0);

    guardarSaldo('dec', 10.5);
    expect(leerSaldo('dec')).toBe(0);

    // Escritura directa, simulando a alguien editando el almacenamiento.
    window.localStorage.setItem('snail.saldo.texto', '"mucho dinero"');
    expect(leerSaldo('texto')).toBe(0);
  });

  it('elimina la clave global de la version anterior', () => {
    // Se escribe a mano la clave que usaba la primera version, con el valor
    // corrupto que aparecio en pruebas manuales.
    window.localStorage.setItem('snail.saldo', '4000000000000702');
    migrarSaldoGlobal();

    expect(window.localStorage.getItem('snail.saldo')).toBeNull();
  });
});

/**
 * Respuesta falsa de SnailPay para controlar el escenario.
 *
 * El status_detail replica lo que devuelve el servicio real, incluido el
 * aviso de que el saldo no cambio. Si el mock usara un texto inventado, la
 * prueba comprobaria el mock y no el comportamiento real.
 */
function respuesta(estado: SnailPayResponse['status'], montoCobrado = 500): SnailPayResponse {
  const detalles: Record<SnailPayResponse['status'], string> = {
    approved: 'Operacion aprobada. Tu saldo fue actualizado correctamente.',
    declined:
      'La tarjeta fue rechazada por el emisor. Verifica los datos e intenta de nuevo. Tu saldo no fue modificado.',
    error:
      'SnailPay no esta disponible en este momento. Tu saldo no fue modificado. Intenta de nuevo mas tarde.',
  };

  return {
    id: 'x',
    status: estado,
    status_detail: detalles[estado],
    // El monto que devuelve la pasarela DEBE coincidir con el que se le pidio.
    // Si el mock dijera otra cantidad, la prueba mediria el mock, no la app.
    transaction_amount: montoCobrado,
    date_created: '2026-01-15T10:00:00.000Z',
    // Solo un cobro aprobado emite codigo de autorizacion.
    authorization_code: estado === 'approved' ? 'SNP-OK' : null,
    reference: 'REF-1',
    payer_id: 'u1',
    payer_email: 'luis@ejemplo.com',
    cardNumber: '1234123412341234',
    cvv: '543',
  };
}

/** Monta el dashboard con una sesion ya iniciada, sin llamar al servidor. */
function montarDashboard() {
  guardarSesion({
    token: 'token-de-prueba',
    user: { id: 'u1', fullName: 'Luis Ramirez', email: 'luis@ejemplo.com' },
  });
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/**
 * Prepara el dashboard con sesion y mocks por defecto.
 *
 * @param estado resultado que devolvera SnailPay
 * @param saldoInicial saldo con el que parte el usuario
 */
function preparar(
  estado: SnailPayResponse['status'] = 'approved',
  saldoInicial = 0,
  montoCobrado = 500,
) {
  guardarSaldo(USUARIO_ID, saldoInicial);
  vi.spyOn(api, 'verificarSesion').mockResolvedValue({
    user: { id: 'u1', fullName: 'Luis Ramirez', email: 'luis@ejemplo.com' },
  });
  vi.spyOn(api, 'obtenerDia').mockResolvedValue({
    date: '2026-01-15',
    seed: 'semilla-2026',
    races: [],
    snails: [],
  });
  const cobrarSpy = vi
    .spyOn(api, 'cobrar')
    .mockResolvedValue(respuesta(estado, montoCobrado));
  montarDashboard();
  return cobrarSpy;
}

/**
 * Abre el modal de recarga y llena los datos de la tarjeta.
 *
 * IMPORTANTE: el campo de monto viene precargado con "100". Por eso se limpia
 * antes de escribir. Sin este clear, escribir "500" produce "100500", que
 * excede el maximo y la recarga se rechaza. Ese fue el modo en que el bug se
 * hizo visible: las pruebas originales pasaban solo porque "100500" era un
 * numero positivo, y la validacion no tenia un techo.
 */
async function llenarFormulario(
  datos: { tarjeta?: string; monto: string },
): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: /recargar/i }));
  await userEvent.type(screen.getByLabelText(/numero de tarjeta/i), datos.tarjeta ?? '1234123412341234');
  await userEvent.type(screen.getByLabelText(/vencimiento/i), '12/26');
  await userEvent.type(screen.getByLabelText(/cvv/i), '543');

  const campoMonto = screen.getByLabelText(/monto a recargar/i);
  await userEvent.clear(campoMonto);
  // type() no acepta cadena vacia: sin esta guarda, el caso de monto vacio
  // falla con "Expected key descriptor but found '' in ''".
  if (datos.monto !== '') {
    await userEvent.type(campoMonto, datos.monto);
  }
}

async function pagar() {
  await userEvent.click(screen.getByRole('button', { name: /^pagar$/i }));
}

describe('REGLA CRITICA: un fallo no modifica el saldo', () => {
  it('con tarjeta rechazada, el saldo sigue igual', async () => {
    preparar('declined', 1000);
    await llenarFormulario({ tarjeta: '4000000000000002', monto: '500' });
    await pagar();

    // Se espera a que la peticion termine.
    await screen.findByText(/no se pudo completar/i);

    // Esta es la asercion que prueba el requisito literal del enunciado.
    expect(leerSaldo(USUARIO_ID)).toBe(1000);
    expect(screen.getByText(/tu saldo no fue modificado/i)).toBeTruthy();
  });

  it('con error del sistema, el saldo sigue igual', async () => {
    preparar('error', 1000);
    await llenarFormulario({ monto: '500' });
    await pagar();

    await screen.findByText(/no se pudo completar/i);
    expect(leerSaldo(USUARIO_ID)).toBe(1000);
  });

  it('con la tarjeta valida, el saldo SI se incrementa', async () => {
    preparar('approved', 1000);
    await llenarFormulario({ monto: '500' });
    await pagar();

    await screen.findByText(/recarga exitosa/i);
    // 1000 + 500
    expect(leerSaldo(USUARIO_ID)).toBe(1500);
  });
});

describe('validacion del monto (bug real corregido)', () => {
  it('bloquea un monto por encima del maximo sin llamar a la API', async () => {
    const spy = preparar();
    await llenarFormulario({ monto: '999999' });
    await pagar();

    expect(await screen.findByText(/monto maximo por recarga/i)).toBeTruthy();
    // Lo importante: no se envio nada al servidor.
    expect(spy).not.toHaveBeenCalled();
  });

  it('bloquea un numero de tarjeta escrito en el campo de monto', async () => {
    // Este es el caso que ocurrio en la prueba manual y produjo un saldo de
    // 4 billones. Se documenta como prueba de regresion.
    const spy = preparar();
    await llenarFormulario({ monto: '4000000000000002' });
    await pagar();

    expect(await screen.findByText(/monto maximo por recarga/i)).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    expect(leerSaldo(USUARIO_ID)).toBe(0);
  });

  it('bloquea un monto vacio', async () => {
    const spy = preparar();
    await llenarFormulario({ monto: '' });
    await pagar();

    expect(await screen.findByText(/escribe un monto/i)).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });

  it('el campo de monto no acepta letras', async () => {
    preparar();
    await userEvent.click(await screen.findByRole('button', { name: /recargar/i }));
    const campoMonto = screen.getByLabelText(/monto a recargar/i);
    await userEvent.clear(campoMonto);
    // "abc" se descarta en cada pulsacion por el filtro de digitos.
    await userEvent.type(campoMonto, 'abc');
    expect((campoMonto as HTMLInputElement).value).toBe('');
  });

  it('acepta un monto dentro del rango y cobra', async () => {
    // El mock cobra 10 000 para que coincida con lo que se escribe.
    const spy = preparar('approved', 0, 10_000);
    await llenarFormulario({ monto: '10000' });
    await pagar();

    await screen.findByText(/recarga exitosa/i);
    expect(spy).toHaveBeenCalled();
    expect(leerSaldo(USUARIO_ID)).toBe(10_000);
  });
});

/*
 * CIERRE AUTOMATICO DEL MODAL
 * ---------------------------------------------------------------------------
 * El dialogo se cierra solo cuando SnailPay aprueba la operacion, y se queda
 * abierto cuando la rechaza. La segunda parte es la importante: si un fallo
 * cerrara el dialogo, el usuario tendria que reabrirlo y escribir de nuevo
 * toda la tarjeta para ver un error que ya se le habia mostrado.
 *
 * La confirmacion no puede vivir dentro del modal, porque se desmonta con el.
 * Por eso se comprueba que el codigo de autorizacion aparezca FUERA del
 * dialogo: es la prueba de que el aviso sobrevive al cierre.
 */
describe('cierre automatico del modal', () => {
  it('cierra el dialogo cuando la recarga es exitosa', async () => {
    preparar('approved');
    await llenarFormulario({ monto: '500' });
    await pagar();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('el aviso conserva el codigo de autorizacion tras cerrarse el modal', async () => {
    preparar('approved');
    await llenarFormulario({ monto: '500' });
    await pagar();

    expect(await screen.findByText(/recarga exitosa/i)).toBeTruthy();
    expect(screen.getByText(/SNP-OK/)).toBeTruthy();
  });

  it('NO cierra el dialogo si la tarjeta es rechazada', async () => {
    preparar('declined', 1000);
    await llenarFormulario({ tarjeta: '4000000000000002', monto: '500' });
    await pagar();

    // El mensaje de fallo tiene que seguir visible y ahi sigue el formulario.
    await screen.findByText(/no se pudo completar/i);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText(/numero de tarjeta/i)).toBeTruthy();
  });
});

/*
 * FORMATEO AUTOMATICO DEL VENCIMIENTO
 * ---------------------------------------------------------------------------
 * Escribir "1226" tiene que producir "12/26". El caso interesante no es el
 * resultado, sino que el usuario NO escriba la barra: por eso la prueba escribe
 * solo digitos. La segunda parte comprueba que teclear la barra a mano siga
 * funcionando, porque el filtro la descarta en lugar de duplicarla.
 */
describe('formateo del vencimiento', () => {
  it('inserta la barra al escribir solo los digitos', async () => {
    preparar();
    await userEvent.click(await screen.findByRole('button', { name: /recargar/i }));

    const campo = screen.getByLabelText(/vencimiento/i);
    await userEvent.type(campo, '1226');
    expect((campo as HTMLInputElement).value).toBe('12/26');
  });

  it('no duplica la barra si el usuario la escribe', async () => {
    preparar();
    await userEvent.click(await screen.findByRole('button', { name: /recargar/i }));

    const campo = screen.getByLabelText(/vencimiento/i);
    await userEvent.type(campo, '12/26');
    expect((campo as HTMLInputElement).value).toBe('12/26');
  });
});

/*
 * FORMATEO DE LA TARJETA
 * ---------------------------------------------------------------------------
 * El guion con el que se ve la tarjeta NO puede viajar en el payload: SnailPay
 * compara contra el numero en crudo. Es el fallo clasico de este patron, y es
 * peligroso por una razon concreta: el cliente tiene la API mockeada en estas
 * pruebas, asi que un envio mal formado pasaria todas las pruebas de aqui y
 * solo fallaria en uso real, con la tarjeta buena rechazada.
 *
 * Por eso la segunda prueba mira el argumento que recibio el mock, y no solo
 * lo que se ve en pantalla.
 */
describe('formateo de la tarjeta', () => {
  it('agrupa los digitos de cuatro en cuatro', async () => {
    preparar();
    await userEvent.click(await screen.findByRole('button', { name: /recargar/i }));

    const campo = screen.getByLabelText(/numero de tarjeta/i);
    await userEvent.type(campo, '1234123412341234');
    expect((campo as HTMLInputElement).value).toBe('1234-1234-1234-1234');
  });

  it('envia a la API los digitos sin guiones', async () => {
    const spy = preparar('approved');
    await llenarFormulario({ monto: '500' });
    await pagar();

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });
    // Lo que sale por la red es el numero pelado, no lo que se ve en pantalla.
    // Con "?" a proposito: si no hubo llamada, la asercion falla mostrando
    // undefined en vez de lanzar un TypeError que taparia el motivo real.
    expect(spy.mock.calls[0]?.[0].cardNumber).toBe('1234123412341234');
  });
});

describe('ruta protegida', () => {
  it('sin sesion, redirige al login y NO muestra el dashboard', async () => {
    // Sin guardar sesion, verificarSesion no debe llamarse siquiera.
    const verificar = vi.spyOn(api, 'verificarSesion');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /iniciar sesion/i })).toBeTruthy();
    });
    // El nombre del usuario en el dashboard NO debe estar presente.
    expect(verificar).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /cerrar sesion/i })).toBeNull();
  });
});

describe('BetStatsPanel', () => {
  it('muestra las cifras en texto plano ademas del grafico', () => {
    render(<BetStatsPanel wins={3} losses={2} />);
    expect(screen.getByText(/3 victorias \(60%\)/)).toBeTruthy();
    expect(screen.getByText(/2 derrotas \(40%\)/)).toBeTruthy();
  });
});

/**
 * El enunciado lista elmanejo de timeout entre los criterios de evaluacion.
 * Estas pruebas fijan el comportamiento: una peticion colgada debe terminar
 * sola, con un error distinguible del fallo de red, y sin dejar temporizadores
 * vivos que disparen avisos mas tarde.
 */
describe('timeout de la peticion', () => {
  /** Respuesta minima valida para un cobro exitoso. */
  const CARGA = {
    cardNumber: '1234123412341234',
    expiryDate: '12/26',
    cvv: '543',
    fullName: 'Luis Ramirez',
    amount: 100,
  };

  /**
   *fetch que nunca responde: solo rechaza si se cancela, igual que un
   * servidor que acepto la conexion pero no contesta.
   */
  function fetchColgado() {
    return vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('La peticion fue cancelada.');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Las pruebas anteriores espian `api.cobrar` y no restauran el espia al
  // terminar. Sin esta limpieza, la llamada de este bloque seguiria resolviendo
  // con el mock anterior y el mock de fetch no se usaria nunca.
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('corta la espera a los 15s y reporta TIMEOUT', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(fetchColgado());

    const promesa = api.cobrar(CARGA);
    // Se promete el rechazo ANTES de avanzar el reloj: si la peticion se
    // colgara, la prueba falla aqui en vez de colgarse hasta el timeout de
    // vitest, que daria un error Mucho mas dificil de leer.
    const rechazo = expect(promesa).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(15_000);
    await rechazo;

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('el mensaje de timeout es distinto al de fallo de red', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchColgado());

    const promesa = api.cobrar(CARGA);
    // Se espera solo el camino del error: el tipado de la promesa es la
    // union de exito y fallo, asi que se narrowea con el rechazo.
    const rechazo = promesa.then(
      () => null,
      (e: ApiError) => e,
    );
    await vi.advanceTimersByTimeAsync(15_000);
    const error = await rechazo;

    expect(error?.code).toBe('TIMEOUT');
    expect(error?.message).not.toBe('No se pudo conectar con el servidor.');
  });

  it('un fallo de red sigue reportando NETWORK_ERROR, no TIMEOUT', async () => {
    // Un servidor caido rechaza el fetch de inmediato, sin agotar el reloj.
    // Es un caso distinto y no debe disfrazarse de timeout.
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(api.cobrar(CARGA)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('una respuesta rapida no se cancela y limpia su temporizador', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'approved', transaction_amount: 100 }),
    } as Response);

    const respuesta = await api.cobrar(CARGA);
    expect(respuesta).toMatchObject({ status: 'approved' });

    // Si el temporizador siguiera vivo, al avanzar el reloj intentaria
    // abortar sobre una peticion ya terminada.
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(30_000);
  });
});
