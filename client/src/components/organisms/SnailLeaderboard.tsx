/**
 * Barras de victorias por caracol.
 *
 * El eje se limita a 6 porque es el maximo teorico con 6 carreras. Fijar el tope
 * mantiene la comparacion igual entre ejecuciones, en vez de que la escala cambie
 * con el resultado.
 *
 * Recharts no dibuja una barra de altura 0 y el caracol sin victorias
 * desaparecia del grafico, asi que se le da un minimo de 1px. Es un parche
 * visual, no un dato.
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
        {/* Filetes en la familia de aceros del proyecto, no la gris por
            defecto de la libreria. */}
        <CartesianGrid stroke="#c9dce8" strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="nombre"
          tick={{ fontSize: 11, fill: '#3f5c76' }}
          tickLine={false}
          axisLine={{ stroke: '#c9dce8' }}
        />
        <YAxis
          domain={[0, 6]}
          allowDecimals={false}
          tick={{ fontSize: 11, fill: '#3f5c76' }}
          tickLine={false}
          axisLine={false}
          label={{
            value: 'Victorias',
            angle: -90,
            position: 'insideLeft',
            fill: '#8aa9c4',
            fontSize: 10,
          }}
        />
        <Tooltip
          cursor={{ fill: 'rgba(29, 45, 68, 0.05)' }}
          formatter={(valor: number) => [`${valor} victoria(s)`, 'Victorias']}
        />
        {/* Relleno explicito: por defecto Recharts pinta la barra en un azul
            que no pertenece a la paleta del proyecto. */}
        <Bar dataKey="victorias" fill="#3f5c76" maxBarSize={52}>
          {/*
            Etiqueta con el valor sobre la barra. Elimina la necesidad de leer
            el eje, que con barras cortas es dificil de interpolar.
          */}
          <LabelList
            dataKey="victorias"
            position="top"
            fontSize={11}
            fill="#3f5c76"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
