import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { useDeletarExame } from '@/hooks/useExames';
import { toast } from 'sonner';
import type { Exame } from '@/types';

interface PassoConcluidoProps {
  exameId: string;
  metricas: Partial<Exame> | null;
  onNovaColeta: () => void;
}

export function PassoConcluido({ exameId, metricas, onNovaColeta }: PassoConcluidoProps) {
  const navigate = useNavigate();
  const { mutateAsync: deletar } = useDeletarExame();

  async function handleDeletar() {
    await deletar(exameId);
    toast.success('Exame excluído');
    onNovaColeta();
  }

  return (
    <div className="space-y-6 text-center max-w-md mx-auto py-8">
      <div className="flex flex-col items-center gap-3">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h1 className="text-[1.5rem] font-bold text-title">Exame concluído!</h1>
        <p className="text-sm text-muted-foreground">Os dados foram recebidos com sucesso.</p>
      </div>

      {/* Resumo das métricas */}
      {metricas && (
        <div className="grid grid-cols-2 gap-3 text-left">
          {[
            { label: 'Qmax', value: `${metricas.fluxoMaximo} mL/s` },
            { label: 'Qmédio', value: `${metricas.fluxoMedio} mL/s` },
            { label: 'Volume', value: `${metricas.volumeMiccao} mL` },
            { label: 'Tempo tot.', value: `${metricas.tempoTotalMiccao} s` },
            { label: 'T. até Qmax', value: `${metricas.tempoAteFluxoMax} s` },
          ].map(({ label, value }) => (
            <Card key={label} className="shadow-card">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold text-sm">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-col gap-3">
        <Button
          className="bg-primary hover:bg-primary-dark text-white"
          onClick={() => navigate(`/exames/${exameId}`)}
        >
          Ver resultado completo
        </Button>
        <Button variant="outline" onClick={onNovaColeta}>
          Nova coleta
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="text-danger hover:text-danger hover:bg-danger/10"
            >
              Excluir exame
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir exame?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita.
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
  );
}
