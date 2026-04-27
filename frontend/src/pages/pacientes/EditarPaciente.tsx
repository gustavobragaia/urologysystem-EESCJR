import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FormPaciente, type FormPacienteData } from '@/components/pacientes/FormPaciente';
import { usePaciente, useAtualizarPaciente } from '@/hooks/usePacientes';
import { Skeleton } from '@/components/ui/skeleton';

export function EditarPaciente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = usePaciente(id!);
  const { mutateAsync } = useAtualizarPaciente(id!);

  async function handleSubmit(formData: FormPacienteData) {
    await mutateAsync(formData);
    toast.success('Paciente atualizado com sucesso!');
    navigate(`/pacientes/${id}`);
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-[1.75rem] font-bold text-title mb-6">Editar paciente</h1>
      <FormPaciente
        defaultValues={data?.paciente}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/pacientes/${id}`)}
        submitLabel="Atualizar"
      />
    </div>
  );
}
