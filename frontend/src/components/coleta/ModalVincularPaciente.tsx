import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePacientes } from '@/hooks/usePacientes';
import { useVincularExame } from '@/hooks/useExamesOrfaos';
import { calcularIdade } from '@/lib/formatters';
import { toast } from 'sonner';

interface ModalVincularPacienteProps {
  exameId: string;
  open: boolean;
  onClose: () => void;
}

export function ModalVincularPaciente({ exameId, open, onClose }: ModalVincularPacienteProps) {
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const { mutateAsync: vincular, isPending } = useVincularExame();

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data, isLoading } = usePacientes(buscaDebounced || undefined);

  async function handleVincular(pacienteId: string) {
    await vincular({ exameId, pacienteId });
    toast.success('Exame vinculado com sucesso!');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular a um paciente</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar paciente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded" />)}

            {!isLoading && data?.pacientes.map((p) => (
              <Card
                key={p.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => !isPending && handleVincular(p.id)}
              >
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {calcularIdade(p.dataNascimento)} anos
                  </p>
                </CardContent>
              </Card>
            ))}

            {!isLoading && data?.pacientes.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Nenhum paciente encontrado
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
