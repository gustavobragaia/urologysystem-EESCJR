import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PacienteCard } from '@/components/pacientes/PacienteCard';
import { usePacientes } from '@/hooks/usePacientes';
import { useExamesOrfaos } from '@/hooks/useExamesOrfaos';

export function ListaPacientes() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data, isLoading, isError, refetch } = usePacientes(buscaDebounced || undefined);
  const { data: orfaosData } = useExamesOrfaos();

  const totalOrfaos = orfaosData?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Badge exames órfãos */}
      {totalOrfaos > 0 && (
        <Link
          to="/coleta/orfaos"
          className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm font-medium hover:bg-danger/15 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {totalOrfaos} {totalOrfaos === 1 ? 'exame sem' : 'exames sem'} paciente vinculado — clique para vincular
        </Link>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[1.75rem] font-bold text-title">Pacientes</h1>
        <Button
          className="bg-primary hover:bg-primary-dark text-white"
          onClick={() => navigate('/pacientes/novo')}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo paciente
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {/* Lista */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-10">
          <p className="text-muted-foreground mb-3">Erro ao carregar pacientes.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!isLoading && !isError && data?.pacientes.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            {buscaDebounced
              ? `Nenhum paciente encontrado para "${buscaDebounced}".`
              : "Nenhum paciente cadastrado. Clique em '+ Novo paciente' para começar."}
          </p>
        </div>
      )}

      {!isLoading && !isError && data && data.pacientes.length > 0 && (
        <div className="space-y-3">
          {data.pacientes.map((p) => (
            <PacienteCard key={p.id} paciente={p} />
          ))}
        </div>
      )}
    </div>
  );
}
