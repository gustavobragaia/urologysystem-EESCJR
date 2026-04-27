import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Leitura } from '@/types';
import { calcularVolumeAcumulado } from '@/lib/calculations';

interface GraficoFluxoProps {
  leituras: Leitura[];
}

export function GraficoFluxo({ leituras }: GraficoFluxoProps) {
  const fluxos = leituras.map((l) => l.fluxo);
  const volumes = calcularVolumeAcumulado(fluxos);

  const dados = leituras.map((l, i) => ({
    tempo: parseFloat((l.indice * 0.1).toFixed(1)),
    fluxo: parseFloat(l.fluxo.toFixed(2)),
    volume: volumes[i],
  }));

  return (
    <div className="w-full h-[320px] md:h-[320px]" style={{ height: 'clamp(240px, 40vw, 320px)' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dfe2e5" />
          <XAxis
            dataKey="tempo"
            label={{ value: 'Tempo (s)', position: 'insideBottom', offset: -2 }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            yAxisId="left"
            label={{ value: 'Fluxo (mL/s)', angle: -90, position: 'insideLeft', offset: 10 }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{ value: 'Volume (mL)', angle: 90, position: 'insideRight', offset: 10 }}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value, name) =>
              name === 'fluxo'
                ? [`${value} mL/s`, 'Fluxo']
                : [`${value} mL`, 'Volume acum.']
            }
            labelFormatter={(l) => `Tempo: ${l}s`}
          />
          <Legend
            formatter={(value) => (value === 'fluxo' ? 'Fluxo (mL/s)' : 'Volume acumulado (mL)')}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="fluxo"
            stroke="#E54C38"
            strokeWidth={2}
            dot={false}
            name="fluxo"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="volume"
            stroke="#0067CD"
            strokeWidth={2}
            dot={false}
            name="volume"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
