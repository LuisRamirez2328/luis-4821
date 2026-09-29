/**
 * MOLECULA: BalanceCard
 * Muestra el saldo con el formato de moneda.
 *
 * Intl.NumberFormat se usa en vez de toFixed() a mano porque maneja el separador
 * de miles y los decimales segun la configuracion regional del navegador. Es
 * un detalle pequeno, pero es la diferencia entre "$1,234.56" y "1234.6".
 */
interface BalanceCardProps {
  balance: number;
}

export function BalanceCard({ balance }: BalanceCardProps) {
  const formato = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });

  return (
    <div className="balance">
      <span className="balance__label">Saldo disponible</span>
      <span className="balance__value">{formato.format(balance)}</span>
    </div>
  );
}
