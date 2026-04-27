import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { api } from '@/services/api';
import type { Exame, Paciente } from '@/types';

type ColetaEstado = 'selecionando' | 'aguardando' | 'concluido';

export function useColeta(pacienteIdInicial?: string) {
  const [estado, setEstado] = useState<ColetaEstado>(
    pacienteIdInicial ? 'aguardando' : 'selecionando'
  );
  const [pacienteId, setPacienteId] = useState<string | null>(pacienteIdInicial ?? null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [exameId, setExameId] = useState<string | null>(null);
  const [metricas, setMetricas] = useState<Partial<Exame> | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const abrirSSE = useCallback(
    async (pid: string) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const apiUrl = import.meta.env.VITE_API_URL ?? '';
      const url = `${apiUrl}/api/coleta/aguardar/${pid}?token=${token}`;

      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener('aguardando', () => {
        setEstado('aguardando');
      });

      es.addEventListener('exame_pronto', async (e) => {
        const { exameId: eid } = JSON.parse(e.data);
        es.close();

        // Buscar métricas do exame
        try {
          const { data: exameData } = await api.get(`/exames/${eid}`);
          setExameId(eid);
          setMetricas(exameData.exame);
          setEstado('concluido');
        } catch {}
      });

      es.addEventListener('cancelado', () => {
        es.close();
        setEstado('selecionando');
      });

      es.addEventListener('timeout', () => {
        es.close();
        setEstado('selecionando');
      });

      es.onerror = () => {
        es.close();
      };
    },
    []
  );

  // Se vier pacienteId inicial, abre SSE imediatamente
  useEffect(() => {
    if (pacienteIdInicial) {
      abrirSSE(pacienteIdInicial);
    }
    return () => {
      eventSourceRef.current?.close();
    };
  }, [pacienteIdInicial, abrirSSE]);

  const selecionarPaciente = useCallback(
    async (p: Paciente) => {
      setPacienteId(p.id);
      setPaciente(p);
      await abrirSSE(p.id);
    },
    [abrirSSE]
  );

  const cancelar = useCallback(async () => {
    eventSourceRef.current?.close();
    if (pacienteId) {
      try {
        await api.post(`/coleta/cancelar/${pacienteId}`);
      } catch {}
    }
    setEstado('selecionando');
    setPacienteId(null);
    setPaciente(null);
  }, [pacienteId]);

  const reiniciar = useCallback(() => {
    eventSourceRef.current?.close();
    setEstado('selecionando');
    setPacienteId(null);
    setPaciente(null);
    setExameId(null);
    setMetricas(null);
  }, []);

  return {
    estado,
    pacienteId,
    paciente,
    exameId,
    metricas,
    selecionarPaciente,
    cancelar,
    reiniciar,
  };
}
