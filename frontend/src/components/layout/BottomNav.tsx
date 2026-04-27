import { NavLink } from 'react-router-dom';
import { Users, Activity, User, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/pacientes', label: 'Pacientes', icon: Users, end: false },
  { to: '/coleta', label: 'Coleta', icon: Activity, end: true },
  { to: '/coleta/orfaos', label: 'Órfãos', icon: Unlink, end: false },
  { to: '/perfil', label: 'Perfil', icon: User, end: false },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border md:hidden">
      <div className="flex">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
