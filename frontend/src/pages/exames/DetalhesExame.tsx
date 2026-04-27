import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Download, RefreshCcw, Trash2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
import { GraficoFluxo } from '@/components/exames/GraficoFluxo';
import { TabelaMetricas } from '@/components/exames/TabelaMetricas';
import { VolumeResidualInput } from '@/components/exames/VolumeResidualInput';
import { ModalVincularPaciente } from '@/components/coleta/ModalVincularPaciente';
import { useExame, useDeletarExame } from '@/hooks/useExames';
import { calcularIdade, formatarDataHora } from '@/lib/formatters';
import { supabase } from '@/services/supabase';

export function DetalhesExame() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useExame(id!);
  const { mutateAsync: deletar } = useDeletarExame();
  const [modalVincularOpen, setModalVincularOpen] = useState(false);

  async function getPdfUrl(download = false) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const apiUrl = import.meta.env.VITE_API_URL ?? '';
    return `${apiUrl}/api/exames/${id}/pdf?token=${token}${download ? '&download=1' : ''}`;
  }

  async function handleAbrirPdf() {
    const url = await getPdfUrl();
    window.open(url, '_blank');
  }

  async function handleBaixarPdf() {
    const url = await getPdfUrl(true);
    window.location.href = url;
  }

  async function handleDeletar() {
    await deletar(id!);
    toast.success('Exame excluído');
    navigate(-1);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-64 rounded" />
        <Skeleton className="h-48 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const { exame, paciente, leituras } = data;

  return (
    <div className="space-y-6">
      {/* Seção 1 — Cabeçalho */}
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          {paciente ? (
            <>
              <h2 className="text-[1.5rem] font-bold text-title">{paciente.nome}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {calcularIdade(paciente.dataNascimento)} anos ·{' '}
                {formatarDataHora(exame.dataExame)}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-[1.5rem] font-bold text-title">Exame sem paciente</h2>
                <Badge variant="destructive" className="bg-danger text-white">
                  Órfão
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatarDataHora(exame.dataExame)}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 border-primary text-primary hover:bg-primary/5"
                onClick={() => setModalVincularOpen(true)}
              >
                <LinkIcon className="w-3.5 h-3.5 mr-1" />
                Vincular a um paciente
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Seção 2 — Gráfico */}
      <div>
        <h3 className="text-[1.25rem] font-bold text-title mb-3">Curva de fluxo × tempo</h3>
        {leituras.length > 0 ? (
          <GraficoFluxo leituras={leituras} />
        ) : (
          <p className="text-sm text-muted-foreground">Sem leituras disponíveis.</p>
        )}
      </div>

      <Separator />

      {/* Seção 3 — Métricas */}
      <div>
        <h3 className="text-[1.25rem] font-bold text-title mb-3">Métricas</h3>
        <TabelaMetricas exame={exame} />

        {/* Volume residual editável */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm font-medium text-body">Volume Residual:</span>
          <VolumeResidualInput exameId={exame.id} valor={exame.volumeResidual} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Medido via ultrassom ou sondagem após o exame
        </p>
      </div>

      <Separator />

      {/* Seção 4 — Ações */}
      <div className="flex flex-wrap gap-3">
        <Button
          className="bg-primary hover:bg-primary-dark text-white"
          onClick={handleAbrirPdf}
        >
          <FileText className="w-4 h-4 mr-1.5" />
          Abrir PDF
        </Button>
        <Button variant="outline" onClick={handleBaixarPdf}>
          <Download className="w-4 h-4 mr-1.5" />
          Baixar PDF
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="border-orange-400 text-orange-600 hover:bg-orange-50">
              <RefreshCcw className="w-4 h-4 mr-1.5" />
              Refazer exame
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Refazer exame?</AlertDialogTitle>
              <AlertDialogDescription>
                O exame atual será excluído e você será redirecionado para iniciar uma nova coleta.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={async () => {
                  const pacId = exame.pacienteId;
                  await deletar(exame.id);
                  navigate(pacId ? `/coleta?pacienteId=${pacId}` : '/coleta');
                }}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="border-danger text-danger hover:bg-danger/10"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Excluir exame
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir exame?</AlertDialogTitle>
              <AlertDialogDescription>
                Todas as leituras serão excluídas permanentemente.
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

      {modalVincularOpen && (
        <ModalVincularPaciente
          exameId={exame.id}
          open={true}
          onClose={() => setModalVincularOpen(false)}
        />
      )}
    </div>
  );
}
