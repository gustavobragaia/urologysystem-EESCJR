import { useState } from 'react';
import { Edit2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAtualizarVolumeResidual } from '@/hooks/useExames';
import { toast } from 'sonner';

interface VolumeResidualInputProps {
  exameId: string;
  valor: number | null;
}

export function VolumeResidualInput({ exameId, valor }: VolumeResidualInputProps) {
  const [editando, setEditando] = useState(false);
  const [novoValor, setNovoValor] = useState(valor?.toString() ?? '');
  const { mutateAsync, isPending } = useAtualizarVolumeResidual(exameId);

  async function handleSalvar() {
    const num = novoValor === '' ? null : parseFloat(novoValor);
    await mutateAsync(num);
    toast.success('Volume residual atualizado');
    setEditando(false);
  }

  if (!editando) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">
          {valor != null ? `${valor} mL` : 'Não medido'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-muted-foreground hover:text-primary"
          onClick={() => setEditando(true)}
        >
          <Edit2 className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="number"
        step="0.1"
        min="0"
        value={novoValor}
        onChange={(e) => setNovoValor(e.target.value)}
        className="h-8 w-28 text-sm"
        placeholder="mL"
        autoFocus
        onKeyDown={(e) => e.key === 'Enter' && handleSalvar()}
      />
      <span className="text-xs text-muted-foreground hidden sm:block">
        Medido via ultrassom/sonda
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="bg-primary hover:bg-primary-dark text-white px-4"
          onClick={handleSalvar}
          disabled={isPending}
        >
          {isPending ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="px-2"
          onClick={() => setEditando(false)}
          disabled={isPending}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
