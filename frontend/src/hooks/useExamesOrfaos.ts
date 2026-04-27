import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

interface ExameOrfao {
  id: string;
  dataExame: string;
  fluxoMaximo: number;
  volumeMiccao: number;
  tempoTotalMiccao: number;
  leiturasPreview: Array<{ indice: number; fluxo: number }>;
}

export function useExamesOrfaos() {
  return useQuery({
    queryKey: ['exames', 'orfaos'],
    queryFn: async () => {
      const { data } = await api.get('/coleta/orfaos');
      return data as { exames: ExameOrfao[]; total: number };
    },
  });
}

export function useVincularExame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ exameId, pacienteId }: { exameId: string; pacienteId: string }) => {
      const { data } = await api.post('/coleta/vincular', { exameId, pacienteId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exames', 'orfaos'] });
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
    },
  });
}
