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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { BetStatsPanel, calcularPorcentajes } from '../components/organisms/BetStatsPanel';
import { AppRoutes } from '../App';
import { guardarSaldo, leerSaldo, inicializarSaldo, guardarSesion } from '../services/storage';
import { api } from '../services/api';
import type { SnailPayResponse } from '@snail/shared';

beforeEach(() => {
  window.localStorage.clear();
  inicializarSaldo();
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
    expect(leerSaldo()).toBe(0);
  });

  it('el saldo sobrevive a una recarga (se relee de LocalStorage)', () => {
    guardarSaldo(750);
    // Simula el F5: una lectura nueva del mismo almacenamiento.
    expect(leerSaldo()).toBe(750);
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
  guardarSaldo(saldoInicial);
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
    expect(leerSaldo()).toBe(1000);
    expect(screen.getByText(/tu saldo no fue modificado/i)).toBeTruthy();
  });

  it('con error del sistema, el saldo sigue igual', async () => {
    preparar('error', 1000);
    await llenarFormulario({ monto: '500' });
    await pagar();

    await screen.findByText(/no se pudo completar/i);
    expect(leerSaldo()).toBe(1000);
  });

  it('con la tarjeta valida, el saldo SI se incrementa', async () => {
    preparar('approved', 1000);
    await llenarFormulario({ monto: '500' });
    await pagar();

    await screen.findByText(/recarga exitosa/i);
    // 1000 + 500
    expect(leerSaldo()).toBe(1500);
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
    expect(leerSaldo()).toBe(0);
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
    expect(leerSaldo()).toBe(10_000);
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
