import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogOut, Key } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';

const senhaSchema = z
  .object({
    novaSenha: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmarSenha: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  });

type SenhaForm = z.infer<typeof senhaSchema>;

export function Perfil() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SenhaForm>({ resolver: zodResolver(senhaSchema) });

  async function handleAlterarSenha(data: SenhaForm) {
    const { error } = await supabase.auth.updateUser({ password: data.novaSenha });
    if (error) {
      toast.error('Erro ao alterar senha');
      return;
    }
    toast.success('Senha alterada com sucesso!');
    reset();
    setDialogOpen(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  const inicial = user?.email?.charAt(0).toUpperCase() ?? 'D';

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-[1.75rem] font-bold text-title">Perfil</h1>

      <Card className="shadow-card">
        <CardContent className="p-6 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-white text-2xl font-bold">{inicial}</span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-title">Dr. Rômulo Nunes</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              <Key className="w-4 h-4 mr-2" />
              Alterar senha
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alterar senha</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(handleAlterarSenha)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nova senha</Label>
                <Input
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
                <Label>Confirmar senha</Label>
                <Input
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
          </DialogContent>
        </Dialog>

        <Button
          variant="outline"
          className="w-full justify-start border-danger text-danger hover:bg-danger/10"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
}
