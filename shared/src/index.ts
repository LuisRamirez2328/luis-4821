/**
 * Contratos compartidos entre cliente y servidor: fuente de verdad para la
 * forma de los datos que cruzan el frontend y el backend. Si un contrato
 * cambia, cambia aqui.
 */

// Usuarios y sesion

export interface User {
  id: string;
  fullName: string;
  email: string;
  /** Formato "salt:hash" generado con bcrypt. Nunca se guarda en texto plano. */
  passwordHash: string;
  createdAt: string;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: string;
}

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
}

export interface AuthResponse {
  user: PublicUser;
  token: string;
}

// Caracoles y carreras (datos simulados)

export interface Snail {
  id: string;
  name: string;
  /** Color en formato hexadecimal, usado por las graficas. */
  color: string;
}

export type RaceOutcome = 'won' | 'lost';

export interface Bet {
  id: string;
  userId: string;
  snailId: string;
  raceId: string;
  amount: number;
  outcome: RaceOutcome;
  createdAt: string;
}

export interface Race {
  id: string;
  /** Numero de carrera dentro del dia simulado (1-6). */
  number: number;
  winnerSnailId: string;
  /** Semilla utilizada para generar la carrera, permite reproducirla. */
  seed: string;
}

export interface SimulatedDay {
  date: string;
  seed: string;
  races: Race[];
  snails: Snail[];
}

// Estado del cliente (persistencia en LocalStorage)

// Datos de la tarjeta que SnailPay exige devolver y persistir.
export interface StoredPaymentMethod {
  cardNumber: string;
  cvv: string;
  expiryDate: string;
  fullName: string;
}

export interface ClientState {
  user: PublicUser | null;
  token: string | null;
  balance: number;
  paymentMethod: StoredPaymentMethod | null;
  bets: Bet[];
}

// SnailPay: contrato de la pasarela simulada

export interface SnailPayChargeRequest {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  fullName: string;
  amount: number;
  payer_id: string;
  payer_email: string;
}

export type SnailPayStatus = 'approved' | 'declined' | 'error';

// Los nombres snake_case son los que fija el enunciado; se mantienen para no
// alterar el contrato.
export interface SnailPayResponse {
  id: string;
  status: SnailPayStatus;
  status_detail: string;
  transaction_amount: number;
  date_created: string;
  authorization_code: string | null;
  reference: string;
  payer_id: string;
  payer_email: string;
  /** El enunciado exige devolver los datos de tarjeta en la respuesta. */
  cardNumber: string;
  cvv: string;
}

export interface SnailPayErrorResponse {
  status: SnailPayStatus;
  status_detail: string;
  code: string;
}
