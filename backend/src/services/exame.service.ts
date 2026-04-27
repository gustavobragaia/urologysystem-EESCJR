import { db } from '../db';
import { exames, leituras } from '../db/schema';
import type { LeituraEsp32, MetricasCalculadas } from './processamento.service';

interface SalvarExameParams {
  medicoId: string;
  pacienteId: string | null;
  metricas: MetricasCalculadas;
  leiturasArray: LeituraEsp32[];
}

export async function salvarExame(params: SalvarExameParams): Promise<string> {
  const { medicoId, pacienteId, metricas, leiturasArray } = params;

  const [novoExame] = await db.insert(exames).values({
    medicoId,
    pacienteId: pacienteId ?? undefined,
    statusVinculacao: pacienteId ? 'vinculado' : 'orfao',
    fluxoMaximo: metricas.fluxoMaximo,
    fluxoMedio: metricas.fluxoMedio,
    volumeMiccao: metricas.volumeMiccao,
    tempoAteFluxoMax: metricas.tempoAteFluxoMax,
    tempoTotalMiccao: metricas.tempoTotalMiccao,
  }).returning({ id: exames.id });

  if (!novoExame) throw new Error('Falha ao inserir exame');

  const leiturasValues = leiturasArray.map((l, idx) => ({
    exameId: novoExame.id,
    indice: parseInt(l.It),
    fluxo: parseFloat(l.Fl),
  }));

  // Inserir em chunks para não sobrecarregar o banco
  const CHUNK_SIZE = 100;
  for (let i = 0; i < leiturasValues.length; i += CHUNK_SIZE) {
    await db.insert(leituras).values(leiturasValues.slice(i, i + CHUNK_SIZE));
  }

  return novoExame.id;
}
