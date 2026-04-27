// Tipos compartilhados entre backend e frontend

export type Sexo = 'M' | 'F' | 'Outro';
export type StatusVinculacao = 'vinculado' | 'orfao';

export interface Paciente {
  id: string;
  medicoId: string;
  nome: string;
  dataNascimento: string; // YYYY-MM-DD
  sexo: Sexo;
  cpf: string | null;
  convenio: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Exame {
  id: string;
  medicoId: string;
  pacienteId: string | null;
  statusVinculacao: StatusVinculacao;
  dataExame: string;
  fluxoMaximo: number;
  fluxoMedio: number;
  volumeMiccao: number;
  tempoAteFluxoMax: number;
  tempoTotalMiccao: number;
  volumeResidual: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Leitura {
  id: string;
  exameId: string;
  indice: number;
  fluxo: number;
  createdAt: string;
}

export interface LeituraEsp32 {
  Fl: string;
  It: string;
}

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
