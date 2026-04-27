import { useSearchParams } from 'react-router-dom';
import { useColeta } from '@/hooks/useColeta';
import { PassoSelecionarPaciente } from '@/components/coleta/PassoSelecionarPaciente';
import { PassoAguardando } from '@/components/coleta/PassoAguardando';
import { PassoConcluido } from '@/components/coleta/PassoConcluido';

export function ColetaFlow() {
  const [searchParams] = useSearchParams();
  const pacienteIdInicial = searchParams.get('pacienteId') ?? undefined;

  const {
    estado,
    paciente,
    exameId,
    metricas,
    selecionarPaciente,
    cancelar,
    reiniciar,
  } = useColeta(pacienteIdInicial);

  if (estado === 'selecionando') {
    return <PassoSelecionarPaciente onContinuar={selecionarPaciente} />;
  }

  if (estado === 'aguardando') {
    return (
      <PassoAguardando
        paciente={paciente}
        onCancelar={cancelar}
        onTrocarPaciente={cancelar}
      />
    );
  }

  if (estado === 'concluido' && exameId) {
    return (
      <PassoConcluido
        exameId={exameId}
        metricas={metricas}
        onNovaColeta={reiniciar}
      />
    );
  }

  return null;
}
