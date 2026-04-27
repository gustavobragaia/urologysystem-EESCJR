import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Paciente } from '@/types';

interface PassoAguardandoProps {
  paciente: Paciente | null;
  onCancelar: () => void;
  onTrocarPaciente: () => void;
}

export function PassoAguardando({ paciente, onCancelar, onTrocarPaciente }: PassoAguardandoProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-8 text-center max-w-md mx-auto py-8">
      <div>
        <h1 className="text-[1.5rem] font-bold text-title">
          Aguardando exame
        </h1>
        {paciente && (
          <p className="text-muted-foreground mt-1">
            de <span className="font-medium text-body">{paciente.nome}</span>
          </p>
        )}
      </div>

      {/* Spinner */}
      <div className="flex justify-center">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-muted" />
          <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-body font-medium">
          O dispositivo está pronto. Peça ao paciente para iniciar a micção.
        </p>
        <p className="text-xs text-muted-foreground">
          Sessão expira em 10 minutos sem dados recebidos
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          onClick={onTrocarPaciente}
        >
          Trocar paciente
        </Button>
        <Button
          variant="outline"
          className="border-danger text-danger hover:bg-danger/10"
          onClick={onCancelar}
        >
          Cancelar coleta
        </Button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button className="text-xs text-muted-foreground hover:text-secondary underline mt-2">
              Problemas com o dispositivo?
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reiniciar dispositivo ESP32</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-body space-y-2">
              <p>Para reiniciar o dispositivo:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Desconecte o cabo USB/alimentação do dispositivo</li>
                <li>Aguarde 5 segundos</li>
                <li>Reconecte o dispositivo</li>
                <li>Aguarde o LED piscar 3 vezes (inicialização completa)</li>
                <li>Cancele esta sessão e inicie uma nova coleta</li>
              </ol>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
