import { NavLink, Outlet } from 'react-router-dom';
import { Users, Activity, User, Unlink } from 'lucide-react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/pacientes', label: 'Pacientes', icon: Users },
  { to: '/coleta', label: 'Coleta', icon: Activity },
  { to: '/coleta/orfaos', label: 'Exames Órfãos', icon: Unlink },
  { to: '/perfil', label: 'Perfil', icon: User },
];

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Sidebar desktop */}
      <aside className="hidden md:flex fixed left-0 top-14 bottom-0 w-56 border-r border-border flex-col bg-white z-40">
        <nav className="flex-1 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/coleta'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-2.5 mx-2 rounded text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-white font-medium'
                    : 'text-body hover:bg-muted'
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="pt-14 pb-20 md:pb-6 md:ml-56">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
