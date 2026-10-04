/**
 * Anillo de victorias y derrotas. Recharts no lo trae, asi que se hace con
 * PieChart y dos sectores.
 *
 * Los datos son simulados (el enunciado prohibe implementar apuestas) y salen
 * de la misma semilla que las carreras, con lo que el anillo y las barras se
 * pueden recalcular a mano.
 *
 * Los dos porcentajes se redondean a enteros porque el anillo necesita sumar
 * 360 grados exactos; si el segundo fuera 100 - primero, el decimal redondeado
 * descuadraria la circunferencia y el sector saldria deformado.
 */
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface BetStatsPanelProps {
  /** Numero de victorias simuladas. */
  wins: number;
  /** Numero de derrotas simuladas. */
  losses: number;
}

/** Calcula los dos porcentajes sin descuadrar el anillo. */
export function calcularPorcentajes(wins: number, losses: number) {
  const total = wins + losses;
  if (total === 0) {
    return { winPct: 0, lossPct: 0 };
  }
  const winPct = Math.round((wins / total) * 100);
  return { winPct, lossPct: 100 - winPct };
}

export function BetStatsPanel({ wins, losses }: BetStatsPanelProps) {
  const { winPct, lossPct } = calcularPorcentajes(wins, losses);

  const datos = [
    { name: 'Victorias', valor: winPct },
    { name: 'Derrotas', valor: lossPct },
  ];

  // Paleta del proyecto: un solo sector en acero oscuro y otro en acero palido.
  // El par se distingue por valor, no por tono, que es como lo resuelve el
  // diseno de referencia.
  const COLORES = ['#3f5c76', '#c9dce8'];

  return (
    <div className="stats-panel">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={datos}
            dataKey="valor"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            // Un pixel de separacion entre sectores, para que se distingan.
            paddingAngle={2}
            stroke="#eaf2f8"
            strokeWidth={2}
          >
            {datos.map((entrada, indice) => (
              <Cell
                key={entrada.name}
                fill={COLORES[indice % COLORES.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={(valor: number) => `${valor}%`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      {/* Texto equivalente en plano. Es el respaldo cuando el grafico no carga. */}
      <ul className="stats-panel__legend">
        <li>
          <span className="dot dot--win" aria-hidden="true" />
          {wins} victoria{wins === 1 ? '' : 's'} ({winPct}%)
        </li>
        <li>
          <span className="dot dot--loss" aria-hidden="true" />
          {losses} derrota{losses === 1 ? '' : 's'} ({lossPct}%)
        </li>
      </ul>
    </div>
  );
}
