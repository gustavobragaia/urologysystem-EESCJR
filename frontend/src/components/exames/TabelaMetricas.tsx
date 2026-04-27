import type { Exame } from '@/types';
import { REFERENCIAS } from '@/types';

interface TabelaMetricasProps {
  exame: Exame;
}

const METRICAS: Array<{
  key: keyof typeof REFERENCIAS;
  getValue: (e: Exame) => string;
}> = [
  { key: 'fluxoMaximo',      getValue: (e) => `${e.fluxoMaximo} mL/s` },
  { key: 'fluxoMedio',       getValue: (e) => `${e.fluxoMedio} mL/s` },
  { key: 'volumeMiccao',     getValue: (e) => `${e.volumeMiccao} mL` },
  { key: 'tempoAteFluxoMax', getValue: (e) => `${e.tempoAteFluxoMax} s` },
  { key: 'tempoTotalMiccao', getValue: (e) => `${e.tempoTotalMiccao} s` },
  {
    key: 'volumeResidual',
    getValue: (e) => (e.volumeResidual != null ? `${e.volumeResidual} mL` : 'Não medido'),
  },
];


export function TabelaMetricas({ exame }: TabelaMetricasProps) {
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-primary text-white">
            <th className="text-left px-4 py-2.5 font-medium">Métrica</th>
            <th className="text-left px-4 py-2.5 font-medium">Valor</th>
            <th className="text-left px-4 py-2.5 font-medium">Referência</th>
          </tr>
        </thead>
        <tbody>
          {METRICAS.map(({ key, getValue }, i) => {
            const ref = REFERENCIAS[key];
            return (
              <tr
                key={key}
                className={i % 2 === 0 ? 'bg-white' : 'bg-muted'}
              >
                <td className="px-4 py-2.5 text-body">{ref.label}</td>
                <td className="px-4 py-2.5 font-medium text-title">{getValue(exame)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {key === 'volumeResidual'
                    ? `< ${ref.max} ${ref.unidade}`
                    : `${(ref as any).min} – ${ref.max} ${ref.unidade}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
