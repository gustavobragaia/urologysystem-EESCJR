import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Paciente } from '@/types';

interface ListaPacientesResponse {
  pacientes: Paciente[];
  total: number;
}

export function usePacientes(busca?: string) {
  return useQuery({
    queryKey: ['pacientes', busca],
    queryFn: async (): Promise<ListaPacientesResponse> => {
      const { data } = await api.get('/pacientes', { params: busca ? { busca } : {} });
      return data;
    },
  });
}

export function usePaciente(id: string) {
  return useQuery({
    queryKey: ['pacientes', id],
    queryFn: async () => {
      const { data } = await api.get(`/pacientes/${id}`);
      return data as { paciente: Paciente; exames: any[] };
    },
    enabled: !!id,
  });
}

export function useCriarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Paciente>) => {
      const { data } = await api.post('/pacientes', body);
      return data.paciente as Paciente;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pacientes'] }),
  });
}

export function useAtualizarPaciente(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Paciente>) => {
      const { data } = await api.patch(`/pacientes/${id}`, body);
      return data.paciente as Paciente;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pacientes'] }),
  });
}

export function useDeletarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pacientes/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pacientes'] }),
  });
}
