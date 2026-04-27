import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Edit, Trash2, Plus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { usePaciente, useDeletarPaciente } from '@/hooks/usePacientes';
import { calcularIdade, formatarData, formatarDataHora, formatarCPF } from '@/lib/formatters';

export function DetalhesPaciente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = usePaciente(id!);
  const { mutateAsync: deletar } = useDeletarPaciente();

  async function handleDeletar() {
    await deletar(id!);
    toast.success('Paciente excluído com sucesso');
    navigate('/pacientes');
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 rounded" />
        <Skeleton className="h-48 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const { paciente, exames } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-bold text-title">{paciente.nome}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {calcularIdade(paciente.dataNascimento)} anos ·{' '}
            {paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Feminino' : 'Outro'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/pacientes/${id}/editar`)}
          >
            <Edit className="w-3.5 h-3.5 mr-1" />
            Editar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-danger text-danger hover:bg-danger/10"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir paciente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os exames e leituras de {paciente.nome} serão excluídos permanentemente. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-danger hover:bg-danger-dark text-white"
                  onClick={handleDeletar}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Dados pessoais */}
      <Card className="shadow-card">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Data de nascimento</p>
            <p className="text-sm font-medium">{formatarData(paciente.dataNascimento)}</p>
          </div>
          {paciente.cpf && (
            <div>
              <p className="text-xs text-muted-foreground">CPF</p>
              <p className="text-sm font-medium">{formatarCPF(paciente.cpf)}</p>
            </div>
          )}
          {paciente.convenio && (
            <div>
              <p className="text-xs text-muted-foreground">Convênio</p>
              <p className="text-sm font-medium">{paciente.convenio}</p>
            </div>
          )}
          {paciente.telefone && (
            <div>
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="text-sm font-medium">{paciente.telefone}</p>
            </div>
          )}
          {paciente.email && (
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{paciente.email}</p>
            </div>
          )}
          {paciente.endereco && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Endereço</p>
              <p className="text-sm font-medium">{paciente.endereco}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Histórico de exames */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[1.5rem] font-bold text-title">Histórico de exames</h2>
          <Button
            className="bg-primary hover:bg-primary-dark text-white"
            onClick={() => navigate(`/coleta?pacienteId=${id}`)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Iniciar nova coleta
          </Button>
        </div>

        {exames.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Nenhum exame realizado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {exames.map((exame) => (
              <Card key={exame.id} className="shadow-card">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{formatarDataHora(exame.dataExame)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Qmax: {exame.fluxoMaximo} mL/s · Volume: {exame.volumeMiccao} mL · Tempo:{' '}
                      {exame.tempoTotalMiccao} s
                    </p>
                  </div>
                  <Link
                    to={`/exames/${exame.id}`}
                    className="flex items-center gap-1 text-primary text-sm hover:text-primary-dark font-medium shrink-0"
                  >
                    Ver resultado
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
