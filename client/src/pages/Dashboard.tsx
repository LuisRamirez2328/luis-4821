/**
 * PAGINA: Dashboard
 * ---------------------------------------------------------------------------
 * Reune los datos del dia simulado y se los pasa a los graficos.
 *
 * ---------------------------------------------------------------------------
 * DE DONDE SALEN VICTORIAS Y DERROTAS DEL ANILLO
 * ---------------------------------------------------------------------------
 * El enunciado pide el grafico de victorias/derrotas pero prohibe implementar
 * apuestas, asi que no existe una apuesta real que estadisticar. Por eso las
 * cifras se SIMULAN de forma determinista a partir de la semilla de las
 * carreras: mismo seed, mismas cifras, siempre.
 *
 * Se calcula AQUI y no dentro del grafico a proposito: los componentes de
 * presentacion no deberian inventar datos. Si el grafico generara sus propios
 * numeros, dos graficos podrian discrepar y seria imposible verificarlos.
 *
 * El conteo de victorias por caracol, en cambio, viene del servidor: el grafico
 * de barras y el anillo se apoyan en la MISMA fuente, asi que son coherentes
 * entre si.
 */
import { useEffect, useState, useMemo } from 'react';
import type { SimulatedDay } from '@snail/shared';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import { ChartCard } from '../components/molecules/ChartCard';
import { BetStatsPanel } from '../components/organisms/BetStatsPanel';
import { SnailLeaderboard } from '../components/organisms/SnailLeaderboard';
import { api } from '../services/api';

/** Deriva victorias y derrotas simuladas de forma reproducible. */
export function derivarEstadisticas(day: SimulatedDay): { wins: number; losses: number } {
  // Se usa el numero de carreras y la suma de ids como semilla estable. Es
  // una funcion pura: mismos datos de entrada, misma salida.
  const base = day.races.reduce((acc, c) => acc + c.number, 0) + day.snails.length;
  const wins = base % 5; // 0..4
  const losses = (day.races.length - wins + 6) % 7; // 0..6
  return { wins, losses };
}

export function Dashboard() {
  const [dia, setDia] = useState<SimulatedDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true; // evita actualizar estado tras desmontar el componente

    async function cargar() {
      try {
        const datos = await api.obtenerDia();
        if (vigente) setDia(datos);
      } catch {
        if (vigente) {
          setError('No se pudieron cargar los datos del dia. Verifica que el servidor este corriendo.');
        }
      }
    }

    void cargar();
    return () => {
      vigente = false;
    };
  }, []);

  // useMemo evita recalcular en cada render. No es critico aqui, pero es la
  // forma correcta de derivar datos de una entrada que no cambia.
  const victorias = useMemo(() => {
    if (!dia) return {};
    const conteo: Record<string, number> = {};
    for (const carrera of dia.races) {
      conteo[carrera.winnerSnailId] = (conteo[carrera.winnerSnailId] ?? 0) + 1;
    }
    // Se inicializan en 0 para que los 6 caracoles aparezcan siempre.
    for (const caracol of dia.snails) {
      conteo[caracol.id] ??= 0;
    }
    return conteo;
  }, [dia]);

  const estadisticas = useMemo(() => (dia ? derivarEstadisticas(dia) : { wins: 0, losses: 0 }), [dia]);

  return (
    <DashboardLayout>
      {error ? (
        <div className="alerta alerta--error" role="alert">
          {error}
        </div>
      ) : null}

      {!dia && !error ? <p className="cargando">Cargando datos del dia...</p> : null}

      {dia ? (
        <div className="dashboard__graficos">
          <ChartCard
            title="Victorias por caracol"
            subtitle={`Dia simulado ${dia.date} - semilla "${dia.seed}"`}
          >
            <SnailLeaderboard victorias={victorias} snails={dia.snails} />
          </ChartCard>

          <ChartCard title="Tu rendimiento" subtitle="Victorias y derrotas (datos simulados)">            <BetStatsPanel wins={estadisticas.wins} losses={estadisticas.losses} />
          </ChartCard>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
