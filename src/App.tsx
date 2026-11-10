import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { lazyTela } from "@/lib/telas";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AvisoDeConexao } from "@/components/AvisoDeConexao";

import { AuthProvider } from "@/contexts/AuthContext"; 
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { CustomerAuthGuard } from "@/components/guards/CustomerAuthGuard";
import { ModuleGuard } from "@/components/guards/ModuleGuard";
import { RoleRedirect } from "@/components/guards/RoleRedirect";
import { AdminEvolutechLayout } from "@/components/layouts/AdminEvolutechLayout";
import { EmpresaLayout } from "@/components/layouts/EmpresaLayout";

// Cada tela vira um arquivo proprio, baixado so quando aberta. Antes era um
// JS unico de 2,3 MB: o cliente que so queria marcar um corte baixava junto o
// leitor de Excel, os graficos e o painel do admin.

// Public pages
const Index = lazyTela(() => import("./pages/Index"));
const Login = lazyTela(() => import("./pages/Login"));
const RedefinirSenha = lazyTela(() => import("./pages/RedefinirSenha"));
const AcceptInvite = lazyTela(() => import("./pages/AcceptInvite"));
const NotFound = lazyTela(() => import("./pages/NotFound"));
const Landing = lazyTela(() => import("./pages/Landing"));
const CustomerLogin = lazyTela(() => import("./pages/customer/CustomerLogin"));
const CustomerRegister = lazyTela(() => import("./pages/customer/CustomerRegister"));
const CustomerDashboard = lazyTela(() => import("./pages/customer/CustomerDashboard"));

// Admin Evolutech pages
const AdminDashboard = lazyTela(() => import("./pages/admin/AdminDashboard"));
const GestaoSistemasBase = lazyTela(() => import("./pages/admin/GestaoSistemasBase"));
const GatewaysPagamento = lazyTela(() => import("./pages/admin/GatewaysPagamento"));
const WhatsAppAutomacao = lazyTela(() => import("./pages/admin/WhatsAppAutomacao"));
const GerenciarUsuarios = lazyTela(() => import("./pages/admin/GerenciarUsuarios"));
const ChatbotsManager = lazyTela(() => import("./pages/admin/ChatbotsManager"));
const SystemVerification = lazyTela(() => import("./pages/admin/SystemVerification"));
const TemaGlobal = lazyTela(() => import("./pages/admin/TemaGlobal"));
const Empresas = lazyTela(() => import("./pages/Empresas"));
const Usuarios = lazyTela(() => import("./pages/Usuarios"));
const Configuracoes = lazyTela(() => import("./pages/Configuracoes"));
const Modulos = lazyTela(() => import("./pages/Modulos"));
const Suporte = lazyTela(() => import("./pages/Suporte"));
const Evolucoes = lazyTela(() => import("./pages/Evolucoes"));
const Treinamentos = lazyTela(() => import("./pages/Treinamentos"));
const MetricasGlobais = lazyTela(() => import("./pages/MetricasGlobais"));
const Financeiro = lazyTela(() => import("./pages/Financeiro"));
const Logs = lazyTela(() => import("./pages/Logs"));

// Public chatbot page
const ChatbotPublic = lazyTela(() => import("./pages/ChatbotPublic"));

// Empresa pages
const EmpresaDashboard = lazyTela(() => import("./pages/empresa/EmpresaDashboard"));
const EmpresaApp = lazyTela(() => import("./pages/empresa/EmpresaApp"));
const ConvitesEquipe = lazyTela(() => import("./pages/empresa/ConvitesEquipe"));
const PermissoesEquipe = lazyTela(() => import("./pages/empresa/PermissoesEquipe"));
const Clientes = lazyTela(() => import("./pages/empresa/Clientes"));
const Produtos = lazyTela(() => import("./pages/empresa/Produtos"));
const Agendamentos = lazyTela(() => import("./pages/empresa/Agendamentos"));
const ServicosAgendamento = lazyTela(() => import("./pages/empresa/ServicosAgendamento"));
const AgendamentoCliente = lazyTela(() => import("./pages/empresa/AgedamentoCliente"));
const ConfirmarAgendamento = lazyTela(() => import("./pages/customer/ConfirmarAgendamento"));
const Pedidos = lazyTela(() => import("./pages/empresa/Pedidos"));
const Pdv = lazyTela(() => import("./pages/empresa/Pdv"));
const Caixa = lazyTela(() => import("./pages/empresa/Caixa"));
const Relatorios = lazyTela(() => import("./pages/empresa/Relatorios"));
const GatewaysEmpresa = lazyTela(() => import("./pages/empresa/Gateways"));
const Cobrancas = lazyTela(() => import("./pages/empresa/Cobrancas"));
const Comissoes = lazyTela(() => import("./pages/empresa/Comissoes"));
const Fidelidade = lazyTela(() => import("./pages/empresa/Fidelidade"));
const Assinaturas = lazyTela(() => import("./pages/empresa/Assinaturas"));
const Cursos = lazyTela(() => import("./pages/empresa/Cursos"));
const Avaliacoes = lazyTela(() => import("./pages/empresa/Avaliacoes"));

/** /cliente/:slug abre a escolha do horario, nao o login. */
const PortaDoCliente = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  return <Navigate to={`/agendar/${slug}`} replace />;
};

const queryClient = new QueryClient();

const CarregandoTela = () => (
  <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Carregando">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CustomerAuthProvider>
          <ThemeProvider>
            <Toaster />
            <Sonner />
            <AvisoDeConexao />
            <BrowserRouter>
              <Suspense fallback={<CarregandoTela />}>
              <Routes>
                {/* Public Routes */}
                {/* "/" e a vitrine do iBarber; o app (redireciona por perfil) e /app. */}
                <Route path="/" element={<Landing />} />
                <Route path="/app" element={<Index />} />
                <Route path="/vendas" element={<Navigate to="/" replace />} />
                {/* Escolha de porta antes do login: cliente ou equipe */}
                <Route path="/entrar" element={<Navigate to="/login" replace />} />
                <Route path="/login/*" element={<Login />} />
                {/* "Cadastro" tambem e ambiguo: quem digita isso quase sempre
                    e cliente novo. Vai para a escolha, nao para o login do dono. */}
                <Route path="/cadastro/*" element={<Navigate to="/login" replace />} />
                <Route path="/aceitar-convite" element={<AcceptInvite />} />
                <Route path="/chat/:slug" element={<ChatbotPublic />} />
                <Route path="/agendar/:slug" element={<AgendamentoCliente />} />
                <Route path="/agendar/:slug/confirmar" element={<ConfirmarAgendamento />} />
                {/* A porta do cliente e o agendamento: conta so no fim. */}
                <Route path="/cliente/:slug" element={<PortaDoCliente />} />
                <Route path="/cliente/login" element={<CustomerLogin />} />
                <Route path="/cliente/cadastro" element={<CustomerRegister />} />
                <Route path="/cliente/:slug/login" element={<CustomerLogin />} />
                <Route path="/cliente/:slug/cadastro" element={<CustomerRegister />} />
                <Route path="/cliente/:slug/esqueci-senha" element={<RedefinirSenha tipo="cliente" />} />
                <Route path="/cliente/:slug/redefinir-senha" element={<RedefinirSenha tipo="cliente" />} />
                <Route path="/esqueci-senha" element={<RedefinirSenha tipo="equipe" />} />
                <Route path="/redefinir-senha" element={<RedefinirSenha tipo="equipe" />} />
                <Route path="/cliente" element={<Navigate to="/cliente/login" replace />} />
                <Route
                  path="/cliente/dashboard"
                  element={
                    <CustomerAuthGuard>
                      <CustomerDashboard />
                    </CustomerAuthGuard>
                  }
                />
                
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
                  {/* Servicos sai da tela de Agendamentos e vira modulo proprio;
                      o acesso continua preso a 'appointments'. */}
                  <Route
                    path="/empresa/servicos"
                    element={
                      <ModuleGuard moduleCode="appointments">
                        <ServicosAgendamento />
                      </ModuleGuard>
                    }
                  />
                  {/* Avaliacoes: o backend entrega ranking ao dono e so a propria nota ao barbeiro. */}
                  <Route
                    path="/empresa/avaliacoes"
                    element={
                      <ModuleGuard moduleCode="appointments">
                        <Avaliacoes />
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
                    path="/empresa/cobrancas"
                    element={
                      <ModuleGuard moduleCode="billing">
                        <Cobrancas />
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
                      <AuthGuard allowedRoles={['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA']}>
                        <ModuleGuard moduleCode="reports">
                          <Relatorios />
                        </ModuleGuard>
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
                    path="/empresa/permissoes"
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA']}>
                        <ModuleGuard moduleCode="permissions">
                          <PermissoesEquipe />
                        </ModuleGuard>
                      </AuthGuard>
                    }
                  />
                  <Route 
                    path="/empresa/financeiro" 
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA']}>
                        <ModuleGuard moduleCode="finance">
                          <Financeiro />
                        </ModuleGuard>
                      </AuthGuard>
                    } 
                  />
                  <Route
                    path="/empresa/comissoes"
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA']}>
                        <ModuleGuard moduleCode="commissions">
                          <Comissoes />
                        </ModuleGuard>
                      </AuthGuard>
                    }
                  />
                  <Route
                    path="/empresa/fidelidade"
                    element={
                      // So o dono: a tela le e grava a regra de pontos, que o
                      // backend restringe ao dono. O funcionario abria e via erro.
                      <AuthGuard allowedRoles={['DONO_EMPRESA']}>
                        <ModuleGuard moduleCode="loyalty">
                          <Fidelidade />
                        </ModuleGuard>
                      </AuthGuard>
                    }
                  />
                  <Route
                    path="/empresa/assinaturas"
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA']}>
                        <ModuleGuard moduleCode="subscriptions">
                          <Assinaturas />
                        </ModuleGuard>
                      </AuthGuard>
                    }
                  />
                  <Route
                    path="/empresa/cursos"
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA']}>
                        <ModuleGuard moduleCode="courses">
                          <Cursos />
                        </ModuleGuard>
                      </AuthGuard>
                    }
                  />
                  {/* Funcionario entra aqui para editar o proprio nome e e-mail.
                      O que e so do dono (avisos e senha) a propria tela esconde. */}
                  <Route 
                    path="/empresa/configuracoes" 
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA']}>
                        <Configuracoes />
                      </AuthGuard>
                    } 
                  />
                  <Route 
                    path="/empresa/temas" 
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA']}>
                        <TemaGlobal />
                      </AuthGuard>
                    } 
                  />
                  <Route path="/empresa/personalizacao" element={<Navigate to="/empresa/temas" replace />} />
                  <Route
                    path="/empresa/gateways"
                    element={
                      <AuthGuard allowedRoles={['DONO_EMPRESA']}>
                        <GatewaysEmpresa />
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
              </Suspense>
            </BrowserRouter>
          </ThemeProvider>
        </CustomerAuthProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
