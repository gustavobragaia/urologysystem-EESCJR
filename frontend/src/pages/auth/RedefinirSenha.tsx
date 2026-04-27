import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/services/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z
  .object({
    novaSenha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    confirmarSenha: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  });

type FormData = z.infer<typeof schema>;

export function RedefinirSenha() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    const { error } = await supabase.auth.updateUser({ password: data.novaSenha });

    if (error) {
      toast.error('Erro ao redefinir senha');
      return;
    }

    toast.success('Senha redefinida com sucesso!');
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-sm shadow-card">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Nova Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="novaSenha">Nova senha</Label>
              <Input
                id="novaSenha"
                type="password"
                placeholder="••••••••"
                {...register('novaSenha')}
                className={errors.novaSenha ? 'border-danger' : ''}
              />
              {errors.novaSenha && (
                <p className="text-xs text-danger">{errors.novaSenha.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmarSenha">Confirmar senha</Label>
              <Input
                id="confirmarSenha"
                type="password"
                placeholder="••••••••"
                {...register('confirmarSenha')}
                className={errors.confirmarSenha ? 'border-danger' : ''}
              />
              {errors.confirmarSenha && (
                <p className="text-xs text-danger">{errors.confirmarSenha.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary-dark text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
