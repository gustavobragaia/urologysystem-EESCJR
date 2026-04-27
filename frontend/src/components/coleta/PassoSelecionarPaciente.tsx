import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePacientes } from '@/hooks/usePacientes';
import { calcularIdade } from '@/lib/formatters';
import type { Paciente } from '@/types';
import { cn } from '@/lib/utils';

interface PassoSelecionarPacienteProps {
  onContinuar: (paciente: Paciente) => void;
}

export function PassoSelecionarPaciente({ onContinuar }: PassoSelecionarPacienteProps) {
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [selecionado, setSelecionado] = useState<Paciente | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data, isLoading } = usePacientes(buscaDebounced || undefined);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.75rem] font-bold text-title">Iniciar coleta</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o paciente para associar ao exame
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar paciente por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded" />)}

        {!isLoading && data?.pacientes.map((p) => (
          <Card
            key={p.id}
            className={cn(
              'cursor-pointer transition-all',
              selecionado?.id === p.id
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'hover:border-primary/50'
            )}
            onClick={() => setSelecionado(p)}
          >
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{p.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {calcularIdade(p.dataNascimento)} anos
                </p>
              </div>
              {selecionado?.id === p.id && (
                <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {!isLoading && data?.pacientes.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            Nenhum paciente encontrado
          </p>
        )}
      </div>

      <Button
        className="w-full bg-primary hover:bg-primary-dark text-white"
        disabled={!selecionado}
        onClick={() => selecionado && onContinuar(selecionado)}
      >
        Continuar
      </Button>
    </div>
  );
}
