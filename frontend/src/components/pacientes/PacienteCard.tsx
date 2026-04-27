import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Paciente } from '@/types';
import { calcularIdade, formatarDataHora } from '@/lib/formatters';

interface PacienteCardProps {
  paciente: Paciente;
}

export function PacienteCard({ paciente }: PacienteCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer hover:shadow-card transition-shadow shadow-sm"
      onClick={() => navigate(`/pacientes/${paciente.id}`)}
    >
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-title truncate">{paciente.nome}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {calcularIdade(paciente.dataNascimento)} anos ·{' '}
            {paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Feminino' : 'Outro'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Último exame:{' '}
            {paciente.ultimoExame
              ? formatarDataHora(paciente.ultimoExame)
              : 'Nenhum exame ainda'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant="outline" className="text-xs">
            {paciente.totalExames ?? 0}{' '}
            {(paciente.totalExames ?? 0) === 1 ? 'exame' : 'exames'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
