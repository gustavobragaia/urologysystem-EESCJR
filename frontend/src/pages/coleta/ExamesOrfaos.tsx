import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Link as LinkIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useExamesOrfaos } from '@/hooks/useExamesOrfaos';
import { useDeletarExame } from '@/hooks/useExames';
import { ModalVincularPaciente } from '@/components/coleta/ModalVincularPaciente';
import { formatarDataHora } from '@/lib/formatters';

export function ExamesOrfaos() {
  const { data, isLoading } = useExamesOrfaos();
  const { mutateAsync: deletar } = useDeletarExame();
  const [modalExameId, setModalExameId] = useState<string | null>(null);

  async function handleDeletar(id: string) {
    await deletar(id);
    toast.success('Exame excluído');
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.75rem] font-bold text-title">Exames sem paciente</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data?.total
            ? `${data.total} ${data.total === 1 ? 'exame recebido' : 'exames recebidos'} sem sessão ativa. Vincule cada um ao paciente correspondente.`
            : 'Nenhum exame órfão no momento.'}
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded" />)}
        </div>
      )}

      {!isLoading && data?.exames.map((exame) => (
        <Card key={exame.id} className="shadow-card">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
              {/* Mini-gráfico */}
              <div className="w-full h-12 sm:w-24 sm:h-10 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={exame.leiturasPreview}>
                    <Line
                      type="monotone"
                      dataKey="fluxo"
                      stroke="#E54C38"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{formatarDataHora(exame.dataExame)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Qmax: {exame.fluxoMaximo} mL/s · Vol: {exame.volumeMiccao} mL · Tempo:{' '}
                  {exame.tempoTotalMiccao} s
                </p>
              </div>

              {/* Ações */}
              <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary-dark text-white flex-1 sm:flex-none"
                  onClick={() => setModalExameId(exame.id)}
                >
                  <LinkIcon className="w-3.5 h-3.5 mr-1" />
                  Vincular
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger hover:text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
                        onClick={() => handleDeletar(exame.id)}
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {modalExameId && (
        <ModalVincularPaciente
          exameId={modalExameId}
          open={true}
          onClose={() => setModalExameId(null)}
        />
      )}
    </div>
  );
}
