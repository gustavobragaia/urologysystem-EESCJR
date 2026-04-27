import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Paciente } from '@/types';

const schema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  dataNascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser YYYY-MM-DD')
    .refine((d) => new Date(d) < new Date(), 'Data não pode ser futura'),
  sexo: z.enum(['M', 'F', 'Outro'] as const),
  cpf: z.string().optional().nullable(),
  convenio: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  endereco: z.string().optional().nullable(),
});

export type FormPacienteData = z.infer<typeof schema>;

interface FormPacienteProps {
  defaultValues?: Partial<Paciente>;
  onSubmit: (data: FormPacienteData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function FormPaciente({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = 'Salvar',
}: FormPacienteProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormPacienteData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: defaultValues?.nome ?? '',
      dataNascimento: defaultValues?.dataNascimento ?? '',
      sexo: defaultValues?.sexo ?? 'M',
      cpf: defaultValues?.cpf ?? '',
      convenio: defaultValues?.convenio ?? '',
      telefone: defaultValues?.telefone ?? '',
      email: defaultValues?.email ?? '',
      endereco: defaultValues?.endereco ?? '',
    },
  });

  const sexo = watch('sexo');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nome */}
        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="nome">Nome completo *</Label>
          <Input
            id="nome"
            {...register('nome')}
            className={errors.nome ? 'border-danger' : ''}
          />
          {errors.nome && <p className="text-xs text-danger">{errors.nome.message}</p>}
        </div>

        {/* Data de Nascimento */}
        <div className="space-y-1.5">
          <Label htmlFor="dataNascimento">Data de Nascimento *</Label>
          <Input
            id="dataNascimento"
            type="date"
            {...register('dataNascimento')}
            className={errors.dataNascimento ? 'border-danger' : ''}
          />
          {errors.dataNascimento && (
            <p className="text-xs text-danger">{errors.dataNascimento.message}</p>
          )}
        </div>

        {/* Sexo */}
        <div className="space-y-1.5">
          <Label>Sexo *</Label>
          <Select value={sexo} onValueChange={(v) => setValue('sexo', v as 'M' | 'F' | 'Outro')}>
            <SelectTrigger className={errors.sexo ? 'border-danger' : ''}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Masculino</SelectItem>
              <SelectItem value="F">Feminino</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* CPF */}
        <div className="space-y-1.5">
          <Label htmlFor="cpf">CPF</Label>
          <Input id="cpf" placeholder="000.000.000-00" {...register('cpf')} />
        </div>

        {/* Convênio */}
        <div className="space-y-1.5">
          <Label htmlFor="convenio">Convênio</Label>
          <Input id="convenio" placeholder="Ex: Unimed" {...register('convenio')} />
        </div>

        {/* Telefone */}
        <div className="space-y-1.5">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            placeholder="(00) 00000-0000"
            {...register('telefone')}
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="paciente@email.com"
            {...register('email')}
            className={errors.email ? 'border-danger' : ''}
          />
          {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
        </div>

        {/* Endereço */}
        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="endereco">Endereço</Label>
          <Input id="endereco" placeholder="Rua, número, bairro, cidade" {...register('endereco')} />
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          className="bg-primary hover:bg-primary-dark text-white"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Salvando...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
