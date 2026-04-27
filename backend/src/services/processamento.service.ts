import { z } from 'zod';

export const leituraEsp32Schema = z.object({
  Fl: z.string().regex(/^\d+\.\d+$/, 'Fl deve ser numérico com casas decimais'),
  It: z.string().regex(/^\d+$/, 'It deve ser inteiro'),
});

export const payloadEsp32Schema = z.array(leituraEsp32Schema)
  .min(1, 'Payload vazio')
  .max(1000, 'Payload excede 1000 leituras');

export type LeituraEsp32 = z.infer<typeof leituraEsp32Schema>;

export const INTERVALO_S = 0.1; // 100ms = 10Hz

export interface MetricasCalculadas {
  fluxoMaximo: number;
  fluxoMedio: number;
  volumeMiccao: number;
  tempoAteFluxoMax: number;
  tempoTotalMiccao: number;
}

export const REFERENCIAS = {
  fluxoMaximo:      { min: 15,  max: 50,  unidade: 'mL/s', label: 'Fluxo Máximo (Qmax)' },
  fluxoMedio:       { min: 10,  max: 25,  unidade: 'mL/s', label: 'Fluxo Médio (Qavg)' },
  volumeMiccao:     { min: 150, max: 500, unidade: 'mL',   label: 'Volume de Micção' },
  tempoAteFluxoMax: { min: 3,   max: 10,  unidade: 's',    label: 'Tempo até Fluxo Máximo' },
  tempoTotalMiccao: { min: 15,  max: 40,  unidade: 's',    label: 'Tempo Total de Micção' },
  volumeResidual:   { min: 0,   max: 50,  unidade: 'mL',   label: 'Volume Residual' },
} as const;

// Trunca o array no fim real do exame.
// ESP32 envia 1000 posições — cortamos quando há 8 zeros consecutivos
// após o primeiro fluxo positivo.
export function truncarLeiturasReais(leituras: LeituraEsp32[]): LeituraEsp32[] {
  const fluxos = leituras.map(l => parseFloat(l.Fl));

  const inicioFluxo = fluxos.findIndex(f => f > 0);
  if (inicioFluxo === -1) {
    throw new Error('Exame inválido: nenhum fluxo positivo detectado');
  }

  let zerosConsecutivos = 0;
  let fimReal = fluxos.length;

  for (let i = inicioFluxo; i < fluxos.length; i++) {
    if (fluxos[i] === 0) {
      zerosConsecutivos++;
      if (zerosConsecutivos === 8) {
        fimReal = i + 1;
        break;
      }
    } else {
      zerosConsecutivos = 0;
    }
  }

  return leituras.slice(0, fimReal);
}

// Calcula as 5 métricas a partir do array truncado.
// Volume Residual é manual e não é calculado aqui.
export function calcularMetricas(leituras: LeituraEsp32[]): MetricasCalculadas {
  if (leituras.length === 0) {
    throw new Error('Array de leituras vazio');
  }

  const fluxos = leituras.map(l => parseFloat(l.Fl));
  const fluxosPositivos = fluxos.filter(f => f > 0);

  if (fluxosPositivos.length === 0) {
    throw new Error('Exame sem fluxo positivo registrado');
  }

  // Fluxo Máximo (Qmax) + índice do pico
  let fluxoMaximo = 0;
  let idxMax = -1;
  for (let i = 0; i < fluxos.length; i++) {
    if (fluxos[i] > fluxoMaximo) {
      fluxoMaximo = fluxos[i];
      idxMax = i;
    }
  }

  // Fluxo Médio (Qavg)
  const somaFluxos = fluxosPositivos.reduce((acc, f) => acc + f, 0);
  const fluxoMedio = somaFluxos / fluxosPositivos.length;

  // Volume de Micção — integral discreta: soma de (fluxo × intervalo)
  const volumeMiccao = fluxosPositivos.reduce((acc, f) => acc + f * INTERVALO_S, 0);

  // Tempo até Fluxo Máximo
  const tempoAteFluxoMax = idxMax * INTERVALO_S;

  // Tempo Total de Micção
  const tempoTotalMiccao = fluxosPositivos.length * INTERVALO_S;

  return {
    fluxoMaximo:      arredondar(fluxoMaximo, 2),
    fluxoMedio:       arredondar(fluxoMedio, 2),
    volumeMiccao:     arredondar(volumeMiccao, 2),
    tempoAteFluxoMax: arredondar(tempoAteFluxoMax, 2),
    tempoTotalMiccao: arredondar(tempoTotalMiccao, 2),
  };
}

function arredondar(valor: number, casas: number): number {
  const fator = Math.pow(10, casas);
  return Math.round(valor * fator) / fator;
}

// Pipeline completo: payload bruto → métricas + leituras truncadas
export function processarExame(payloadBruto: unknown): {
  metricas: MetricasCalculadas;
  leiturasTruncadas: LeituraEsp32[];
} {
  const payload = payloadEsp32Schema.parse(payloadBruto);
  const leiturasTruncadas = truncarLeiturasReais(payload);
  const metricas = calcularMetricas(leiturasTruncadas);
  return { metricas, leiturasTruncadas };
}
