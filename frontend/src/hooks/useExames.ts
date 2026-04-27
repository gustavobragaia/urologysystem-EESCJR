import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Exame, Leitura } from '@/types';
import type { Paciente } from '@/types';

export function useExame(id: string) {
  return useQuery({
    queryKey: ['exames', id],
    queryFn: async () => {
      const { data } = await api.get(`/exames/${id}`);
      return data as { exame: Exame; paciente: Paciente | null; leituras: Leitura[] };
    },
    enabled: !!id,
  });
}

export function useAtualizarVolumeResidual(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (volumeResidual: number | null) => {
      const { data } = await api.patch(`/exames/${id}`, { volumeResidual });
      return data.exame as Exame;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exames', id] }),
  });
}

export function useDeletarExame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/exames/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exames'] });
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
    },
  });
}
