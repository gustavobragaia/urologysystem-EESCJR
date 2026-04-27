import { useNavigate } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const navigate = useNavigate();
  const { user } = useAuth();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-brand h-14 flex items-center px-4">
      <div className="flex-1" />

      <div className="flex-1 flex justify-center">
        <img
          src="/urologistaromulo-logo.svg"
          alt="Dr. Rômulo Nunes — Urofluxometria"
          className="h-8 w-auto"
        />
      </div>

      <div className="flex-1 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 p-1.5 rounded hover:bg-white/10 transition-colors">
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user?.email?.charAt(0).toUpperCase() ?? 'D'}
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate('/perfil')}>
              <User className="w-4 h-4 mr-2" />
              Meu perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-danger focus:text-danger">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
