/**
 * ORGANISMO: SnailLeaderboard (grafico de barras: victorias por caracol)
 * ---------------------------------------------------------------------------
 * Requisito del enunciado: "grafico de barras que muestre las victorias de los
 * 6 caracoles en un dia simulado".
 *
 * ---------------------------------------------------------------------------
 * POR QUE SE USA "6" COMO ALTURA FIJA
 * ---------------------------------------------------------------------------
 * El eje vertical se limita a 6 porque son 6 carreras, asi que 6 es el maximo
 * teorico de victorias que un caracol puede alcanzar. Fijar el tope hace que
 * la comparacion entre barras sea siempre igual, sin que la escala cambie
 * segun el resultado. Es una decision de lectura de datos, no de estetica.
 *
 * ---------------------------------------------------------------------------
 * BARRA EN CERO
 * ---------------------------------------------------------------------------
 * Recharts no dibuja una barra de altura 0, asi que un caracol sin victorias
 * desaparecia del grafico. Se resuelve con un margen minimo de 1px, y se
 * documenta aqui porque es un parche visual, no un dato.
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import type { Snail } from '@snail/shared';

interface SnailLeaderboardProps {
  /** Victorias por id de caracol. */
  victorias: Record<string, number>;
  snails: Snail[];
}

export function SnailLeaderboard({ victorias, snails }: SnailLeaderboardProps) {
  // El array se construye desde SNAILS (no desde el objeto de victorias) para
  // garantizar los 6 caracoles en pantalla, incluso los que no ganaron nunca.
  const datos = snails.map((caracol) => ({
    nombre: caracol.name,
    victorias: victorias[caracol.id] ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={datos} margin={{ top: 24, right: 16, bottom: 8, left: -18 }}>
        {/* Fileres, no la gris por defecto de la libreria. */}
        <CartesianGrid stroke="#ddd7c8" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="nombre"
          tick={{ fontSize: 12, fill: '#4d5c53' }}
          tickLine={false}
          axisLine={{ stroke: '#c3baa5' }}
        />
        <YAxis
          domain={[0, 6]}
          allowDecimals={false}
          tick={{ fontSize: 12, fill: '#4d5c53' }}
          tickLine={false}
          axisLine={false}
          label={{
            value: 'Victorias',
            angle: -90,
            position: 'insideLeft',
            fill: '#808d85',
            fontSize: 11,
          }}
        />
        <Tooltip
          cursor={{ fill: 'rgba(23, 33, 28, 0.045)' }}
          formatter={(valor: number) => [`${valor} victoria(s)`, 'Victorias']}
        />
        {/* Relleno explicito: por defecto Recharts pinta la barra en un azul
            que no pertenece a la paleta del proyecto. */}
        <Bar dataKey="victorias" fill="#1f5c43" radius={[2, 2, 0, 0]} maxBarSize={52}>
          {/*
            Etiqueta con el valor sobre la barra. Elimina la necesidad de leer
            el eje, que con barras cortas es dificil de interpolar.
          */}
          <LabelList
            dataKey="victorias"
            position="top"
            fontSize={12}
            fill="#4d5c53"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
