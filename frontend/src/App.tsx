import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Login } from '@/pages/auth/Login';
import { RecuperarSenha } from '@/pages/auth/RecuperarSenha';
import { RedefinirSenha } from '@/pages/auth/RedefinirSenha';
import { ListaPacientes } from '@/pages/pacientes/ListaPacientes';
import { NovoPaciente } from '@/pages/pacientes/NovoPaciente';
import { DetalhesPaciente } from '@/pages/pacientes/DetalhesPaciente';
import { EditarPaciente } from '@/pages/pacientes/EditarPaciente';
import { ColetaFlow } from '@/pages/coleta/ColetaFlow';
import { ExamesOrfaos } from '@/pages/coleta/ExamesOrfaos';
import { DetalhesExame } from '@/pages/exames/DetalhesExame';
import { Perfil } from '@/pages/perfil/Perfil';

function NotFound() {
  return (
    <div className="text-center py-20">
      <h2 className="text-2xl font-bold text-title mb-2">Página não encontrada</h2>
      <p className="text-muted-foreground">O endereço acessado não existe.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        <Route path="/redefinir-senha" element={<RedefinirSenha />} />

        {/* Rotas protegidas */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/pacientes" replace />} />
          <Route path="/pacientes" element={<ListaPacientes />} />
          <Route path="/pacientes/novo" element={<NovoPaciente />} />
          <Route path="/pacientes/:id" element={<DetalhesPaciente />} />
          <Route path="/pacientes/:id/editar" element={<EditarPaciente />} />
          <Route path="/coleta" element={<ColetaFlow />} />
          <Route path="/coleta/orfaos" element={<ExamesOrfaos />} />
          <Route path="/exames/:id" element={<DetalhesExame />} />
          <Route path="/perfil" element={<Perfil />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
