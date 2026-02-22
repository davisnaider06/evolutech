import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ClerkProvider, SignUp } from "@clerk/clerk-react"; // Adicionado Clerk

// Mantemos o AuthProvider por enquanto, mas vamos reescrever o miolo dele no próximo passo
import { AuthProvider } from "@/contexts/AuthContext"; 
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { RoleRedirect } from "@/components/guards/RoleRedirect";
import { AdminEvolutechLayout } from "@/components/layouts/AdminEvolutechLayout";
import { EmpresaLayout } from "@/components/layouts/EmpresaLayout";

// Public pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";
import LandingVendas from "./pages/LandingVendas";

// Admin Evolutech pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import GestaoSistemasBase from "./pages/admin/GestaoSistemasBase";
import GatewaysPagamento from "./pages/admin/GatewaysPagamento";
import WhatsAppAutomacao from "./pages/admin/WhatsAppAutomacao";
import GerenciarUsuarios from "./pages/admin/GerenciarUsuarios";
import ChatbotsManager from "./pages/admin/ChatbotsManager";
import SystemVerification from "./pages/admin/SystemVerification";
import TemaGlobal from "./pages/admin/TemaGlobal";
import Empresas from "./pages/Empresas";
import Usuarios from "./pages/Usuarios";
import Configuracoes from "./pages/Configuracoes";
import Modulos from "./pages/Modulos";
import Suporte from "./pages/Suporte";
import Evolucoes from "./pages/Evolucoes";
import Treinamentos from "./pages/Treinamentos";
import MetricasGlobais from "./pages/MetricasGlobais";
import Financeiro from "./pages/Financeiro";
import Logs from "./pages/Logs";

// Public chatbot page
import ChatbotPublic from "./pages/ChatbotPublic";

// Empresa pages
import EmpresaDashboard from "./pages/empresa/EmpresaDashboard";
import EmpresaApp from "./pages/empresa/EmpresaApp";
import ConvitesEquipe from "./pages/empresa/ConvitesEquipe";
import Clientes from "./pages/empresa/Clientes";
import Produtos from "./pages/empresa/Produtos";
import Agendamentos from "./pages/empresa/Agendamentos";
import AgendamentoCliente from "./pages/empresa/AgedamentoCliente";
import Pedidos from "./pages/empresa/Pedidos";
import Pdv from "./pages/empresa/Pdv";
import Caixa from "./pages/empresa/Caixa";
import Relatorios from "./pages/empresa/Relatorios";
import Personalizacao from "./pages/empresa/Personalizacao";

const queryClient = new QueryClient();

// Importante: Garanta que esta chave está no seu .env
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error("Faltando a Key do Clerk no .env (VITE_CLERK_PUBLISHABLE_KEY)");
}

const App = () => (
  // 1. Envolvendo a aplicação com o ClerkProvider
  <ClerkProvider publishableKey={clerkPubKey}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* 2. AuthProvider mantido ESTRUTURALMENTE. 
          Próximo passo: alterar o arquivo AuthContext.tsx para consumir o Clerk 
          em vez do Supabase, mantendo a compatibilidade com AuthGuard.
        */}
        <AuthProvider>
          <ThemeProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Index />} />
                <Route path="/vendas" element={<LandingVendas />} />
                <Route path="/login/*" element={<Login />} />
                <Route path="/cadastro/*" element={<SignUp />} />
                <Route path="/aceitar-convite" element={<AcceptInvite />} />
                <Route path="/chat/:slug" element={<ChatbotPublic />} />
                <Route path="/agendar/:slug" element={<AgendamentoCliente />} />
                
                {/* Role-based redirect after login */}
                <Route path="/redirect" element={<RoleRedirect />} />
                
                {/* Legacy dashboard route - redirect to role-based route */}
                <Route path="/dashboard" element={<RoleRedirect />} />
                
                {/* ============================================ */}
                {/* ADMIN EVOLUTECH ROUTES                       */}
                {/* Super Admin & Admin Evolutech only           */}
                {/* ============================================ */}
                <Route
                  element={
                    <AuthGuard allowedRoles={['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']}>
                      <AdminEvolutechLayout />
                    </AuthGuard>
                  }
                >
                  <Route path="/admin-evolutech" element={<AdminDashboard />} />
                  <Route path="/admin-evolutech/operacional" element={<AdminDashboard />} />
                  <Route path="/admin-evolutech/empresas" element={<Empresas />} />
                  <Route path="/admin-evolutech/sistemas-base" element={<GestaoSistemasBase />} />
                  <Route path="/admin-evolutech/modulos" element={<Modulos />} />
                  <Route path="/admin-evolutech/usuarios" element={<Usuarios />} />
                  <Route path="/admin-evolutech/gerenciar-usuarios" element={<GerenciarUsuarios />} />
                  <Route path="/admin-evolutech/gateways" element={<GatewaysPagamento />} />
                  <Route path="/admin-evolutech/whatsapp" element={<WhatsAppAutomacao />} />
                  <Route path="/admin-evolutech/chatbots" element={<ChatbotsManager />} />
                  <Route path="/admin-evolutech/suporte" element={<Suporte />} />
                  <Route path="/admin-evolutech/evolucoes" element={<Evolucoes />} />
                  <Route path="/admin-evolutech/treinamentos" element={<Treinamentos />} />
                  <Route path="/admin-evolutech/logs" element={<Logs />} />
                  <Route path="/admin-evolutech/verificacao" element={<SystemVerification />} />
                  <Route path="/admin-evolutech/temas" element={<TemaGlobal />} />
                  <Route path="/admin-evolutech/configuracoes" element={<Configuracoes />} />
                  
                  {/* Super Admin Only */}
                  <Route 
                    path="/admin-evolutech/metricas" 
                    element={
                      <AuthGuard allowedRoles={['SUPER_ADMIN_EVOLUTECH']}>
                        <MetricasGlobais />
                      </AuthGuard>
                    } 
                  />
                  <Route 
                    path="/admin-evolutech/financeiro" 
                    element={
                      <AuthGuard allowedRoles={['SUPER_ADMIN_EVOLUTECH']}>
                        <Financeiro />
                      </AuthGuard>
                    } 
                  />
                </Route>

                {/* ============================================ */}
                {/* EMPRESA ROUTES                               */}
                {/* Dono Empresa & Funcionário only              */}
                {/* ============================================ */}
                <Route
                  element={
                    <AuthGuard allowedRoles={['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA']} requireCompany>
                      <EmpresaLayout />
                    </AuthGuard>
                  }
                >
                  {/* Dono Empresa Dashboard */}
                  <Route 
                    path="/empresa/dashboard" 
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA']}>
                        <EmpresaDashboard />
                      </AuthGuard>
                    } 
                  />
                  
                  {/* Funcionário App */}
                  <Route 
                    path="/empresa/app" 
                    element={<EmpresaApp />} 
                  />
                  
                  {/* Common empresa routes */}
                  <Route
                    path="/empresa/suporte"
                    element={
                      <ModuleGuard moduleCode="support">
                        <Suporte />
                      </ModuleGuard>
                    }
                  />
                  <Route
                    path="/empresa/treinamentos"
                    element={
                      <ModuleGuard moduleCode="training">
                        <Treinamentos />
                      </ModuleGuard>
                    }
                  />
                  
                  {/* CRUD Module Routes */}
                  <Route
                    path="/empresa/clientes"
                    element={
                      <ModuleGuard moduleCode="customers">
                        <Clientes />
                      </ModuleGuard>
                    }
                  />
                  <Route
                    path="/empresa/produtos"
                    element={
                      <ModuleGuard moduleCode="products">
                        <Produtos />
                      </ModuleGuard>
                    }
                  />
                  <Route
                    path="/empresa/agendamentos"
                    element={
                      <ModuleGuard moduleCode="appointments">
                        <Agendamentos />
                      </ModuleGuard>
                    }
                  />
                  <Route
                    path="/empresa/pdv"
                    element={
                      <ModuleGuard moduleCode="pdv">
                        <Pdv />
                      </ModuleGuard>
                    }
                  />
                  <Route
                    path="/empresa/pedidos"
                    element={
                      <ModuleGuard moduleCode="orders">
                        <Pedidos />
                      </ModuleGuard>
                    }
                  />
                  <Route
                    path="/empresa/caixa"
                    element={
                      <ModuleGuard moduleCode="cash">
                        <Caixa />
                      </ModuleGuard>
                    }
                  />
                  <Route
                    path="/empresa/relatorios"
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA']}>
                        <Relatorios />
                      </AuthGuard>
                    }
                  />
                  
                  {/* Dono Empresa Only */}
                  <Route 
                    path="/empresa/equipe" 
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA']}>
                        <ConvitesEquipe />
                      </AuthGuard>
                    } 
                  />
                  <Route
                    path="/empresa/financeiro" 
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA']}>
                        <ModuleGuard moduleCode="finance">
                          <Financeiro />
                        </ModuleGuard>
                      </AuthGuard>
                    } 
                  />
                  <Route 
                    path="/empresa/configuracoes" 
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA']}>
                        <Configuracoes />
                      </AuthGuard>
                    } 
                  />
                  <Route 
                    path="/empresa/personalizacao" 
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA']}>
                        <Personalizacao />
                      </AuthGuard>
                    } 
                  />
                </Route>

                {/* ============================================ */}
                {/* LEGACY ROUTES - Redirect to new structure    */}
                {/* ============================================ */}
                <Route path="/empresas" element={<Navigate to="/admin-evolutech/empresas" replace />} />
                <Route path="/usuarios" element={<Navigate to="/admin-evolutech/usuarios" replace />} />
                <Route path="/sistemas-base" element={<Navigate to="/admin-evolutech/sistemas-base" replace />} />
                <Route path="/modulos" element={<Navigate to="/admin-evolutech/modulos" replace />} />
                <Route path="/suporte" element={<Navigate to="/admin-evolutech/suporte" replace />} />
                <Route path="/evolucoes" element={<Navigate to="/admin-evolutech/evolucoes" replace />} />
                <Route path="/treinamentos" element={<Navigate to="/admin-evolutech/treinamentos" replace />} />
                <Route path="/metricas" element={<Navigate to="/admin-evolutech/metricas" replace />} />
                <Route path="/financeiro" element={<Navigate to="/admin-evolutech/financeiro" replace />} />
                <Route path="/logs" element={<Navigate to="/admin-evolutech/logs" replace />} />
                <Route path="/configuracoes" element={<Navigate to="/admin-evolutech/configuracoes" replace />} />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ThemeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>
);

export default App;
