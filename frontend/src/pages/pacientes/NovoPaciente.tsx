import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FormPaciente, type FormPacienteData } from '@/components/pacientes/FormPaciente';
import { useCriarPaciente } from '@/hooks/usePacientes';

export function NovoPaciente() {
  const navigate = useNavigate();
  const { mutateAsync } = useCriarPaciente();

  async function handleSubmit(data: FormPacienteData) {
    const paciente = await mutateAsync(data);
    toast.success('Paciente cadastrado com sucesso!');
    navigate(`/pacientes/${paciente.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-[1.75rem] font-bold text-title mb-6">Novo paciente</h1>
      <FormPaciente onSubmit={handleSubmit} onCancel={() => navigate('/pacientes')} />
    </div>
  );
}
