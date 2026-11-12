import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyModules } from '@/hooks/useCompanyModules';
import { RoleBadge } from '@/components/RoleBadge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FundoVidro } from '@/components/layouts/FundoVidro';
import { ConteudoDaRota } from '@/components/layouts/ConteudoDaRota';
import { useTemaVidro } from '@/hooks/useTemaVidro';
import { precarregarTelas } from '@/lib/telas';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Menu,
  X,
  Bell,
  Moon,
  Sun,
  HeadphonesIcon,
  GraduationCap,
  CreditCard,
  Building2,
  UserPlus,
  Calendar,
  Package,
  Wallet,
  BarChart3,
  ShoppingCart,
  ReceiptText,
  Palette,
  Gift,
  Repeat,
  BookOpen,
  Scissors,
  ListTodo,
  Store,
  Percent,
  Star,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  moduleCode?: string; // If tied to a module
  ownerOnly?: boolean; // Only for DONO_EMPRESA
  alwaysShow?: boolean; // Always show regardless of modules
  staffOnly?: boolean;
  group: NavGroup;
}

// Grupos no lugar de uma lista corrida de ate 24 itens: o dono acha o assunto
// pelo grupo, e no celular a gaveta fica legivel. O que se usa raramente (ou
// so uma vez, na configuracao) fica em "Mais opcoes", fechado: com tudo
// aberto o dono novo nao sabia por onde comecar.
type NavGroup = 'inicio' | 'atendimento' | 'vendas' | 'dinheiro' | 'gestao' | 'mais';

const GROUP_LABELS: Record<NavGroup, string> = {
  inicio: '',
  atendimento: 'Atendimento',
  vendas: 'Vendas',
  dinheiro: 'Dinheiro',
  gestao: 'Gestão',
  mais: 'Mais opções',
};

const GROUP_ORDER: NavGroup[] = ['inicio', 'atendimento', 'vendas', 'dinheiro', 'gestao', 'mais'];

// 'Estoque' saiu: o item apontava para /empresa/estoque, rota que nunca
// existiu — quem tinha o modulo inventory caia no 404.
const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Painel', path: '/empresa/dashboard', moduleCode: 'dashboard', ownerOnly: true, group: 'inicio' },

  { icon: Calendar, label: 'Agenda', path: '/empresa/agendamentos', moduleCode: 'appointments', group: 'atendimento' },
  { icon: Users, label: 'Clientes', path: '/empresa/clientes', moduleCode: 'customers', group: 'atendimento' },
  // Servicos era um card dentro de Agendamentos. Como item de menu proprio
  // abre direto no assunto, o que no celular faz diferenca.
  //
  // 'Horarios' saiu: a barbearia abre das 9h30 as 21h para todo mundo, e quem
  // nao pode num horario usa Bloquear horario na propria agenda. Expediente
  // por barbeiro criava barbeiro sem agenda nenhuma. A tela existe no historico
  // (commit cb129f4) se outra barbearia precisar.
  { icon: Scissors, label: 'Serviços', path: '/empresa/servicos', moduleCode: 'appointments', group: 'atendimento' },
  { icon: Gift, label: 'Fidelidade', path: '/empresa/fidelidade', moduleCode: 'loyalty', ownerOnly: true, group: 'atendimento' },
  { icon: Star, label: 'Avaliações', path: '/empresa/avaliacoes', moduleCode: 'appointments', group: 'atendimento' },
  { icon: Repeat, label: 'Assinaturas', path: '/empresa/assinaturas', moduleCode: 'subscriptions', group: 'atendimento' },
  // So para o funcionario: o dono ja ve as pendencias no topo do Painel, e
  // menu curto e o que pede o dono que se perde com muita opcao.
  { icon: ListTodo, label: 'Minhas tarefas', path: '/empresa/app', moduleCode: 'app', alwaysShow: true, staffOnly: true, group: 'atendimento' },

  // "Vender" em vez de "PDV": sigla que o dono de barbearia nem sempre conhece.
  { icon: Store, label: 'Vender', path: '/empresa/pdv', moduleCode: 'pdv', group: 'vendas' },
  { icon: Package, label: 'Produtos', path: '/empresa/produtos', moduleCode: 'products', group: 'vendas' },
  { icon: ShoppingCart, label: 'Pedidos', path: '/empresa/pedidos', moduleCode: 'orders', group: 'mais' },
  { icon: BookOpen, label: 'Cursos', path: '/empresa/cursos', moduleCode: 'courses', group: 'mais' },

  { icon: Wallet, label: 'Caixa', path: '/empresa/caixa', moduleCode: 'cash', group: 'dinheiro' },
  { icon: ReceiptText, label: 'Cobranças', path: '/empresa/cobrancas', moduleCode: 'billing', group: 'mais' },
  { icon: Percent, label: 'Comissões', path: '/empresa/comissoes', moduleCode: 'commissions', group: 'dinheiro' },
  { icon: TrendingUp, label: 'Financeiro', path: '/empresa/financeiro', moduleCode: 'finance', group: 'dinheiro' },
  { icon: BarChart3, label: 'Relatórios', path: '/empresa/relatorios', moduleCode: 'reports', group: 'mais' },
  // Gateways e um modulo como outro qualquer: so aparece para quem recebeu.
  // Antes vinha com `alwaysShow` e o codigo 'finance', entao todo dono via a
  // tela de gateways mesmo sem nunca ter contratado meio de pagamento.
  // "Gateways" e jargao: para o dono e receber pagamento pelo celular.
  { icon: CreditCard, label: 'Pagamento online', path: '/empresa/gateways', moduleCode: 'gateways', ownerOnly: true, group: 'mais' },

  { icon: UserPlus, label: 'Equipe', path: '/empresa/equipe', moduleCode: 'users', ownerOnly: true, group: 'gestao' },
  { icon: ShieldCheck, label: 'O que cada um vê', path: '/empresa/permissoes', moduleCode: 'permissions', ownerOnly: true, group: 'mais' },
  { icon: Palette, label: 'Aparência', path: '/empresa/temas', moduleCode: 'design', ownerOnly: true, alwaysShow: true, group: 'mais' },
  { icon: Settings, label: 'Configurações', path: '/empresa/configuracoes', moduleCode: 'settings', alwaysShow: true, group: 'gestao' },
  { icon: HeadphonesIcon, label: 'Suporte', path: '/empresa/suporte', moduleCode: 'support', group: 'gestao' },
  { icon: GraduationCap, label: 'Tutoriais', path: '/empresa/treinamentos', moduleCode: 'training', group: 'mais' },
];

const MobileDockItem: React.FC<{
  icon: React.ElementType;
  label: string;
  path: string;
  active: boolean;
  central?: boolean;
  onClick: (path: string) => void;
}> = ({ icon: Icon, label, path, active, central = false, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(path)}
    aria-current={active ? 'page' : undefined}
    className={cn(
      'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-medium transition-colors',
      active ? 'text-primary' : 'text-white/65 hover:text-white',
      central && 'relative -translate-y-3',
    )}
  >
    <span className={cn(
      'flex h-9 w-9 items-center justify-center rounded-xl',
      central && 'h-12 w-12 rounded-2xl border border-primary/25 bg-primary text-primary-foreground shadow-lg shadow-primary/35',
      active && !central && 'bg-white/10',
    )}>
      <Icon className={central ? 'h-5 w-5' : 'h-5 w-5'} />
    </span>
    <span>{label}</span>
  </button>
);

export const EmpresaLayout: React.FC = () => {
  const { user, logout, company } = useAuth();
  const { hasModuleForCurrentRole, isLoading: carregandoModulos } = useCompanyModules();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modoClaro, setModoClaro] = useState(() => localStorage.getItem('evolutech_modo') !== 'escuro');
  // Abre sozinho quando a tela atual mora em "Mais opcoes", para o item ativo
  // nao ficar escondido.
  const [maisAberto, setMaisAberto] = useState(() =>
    navItems.some((item) => item.group === 'mais' && location.pathname.startsWith(item.path))
  );

  const isOwner = user?.role === 'DONO_EMPRESA';
  useTemaVidro();
  React.useEffect(() => {
    document.body.classList.toggle('modo-claro', modoClaro);
    localStorage.setItem('evolutech_modo', modoClaro ? 'claro' : 'escuro');
    return () => document.body.classList.remove('modo-claro');
  }, [modoClaro]);
  // Baixa o codigo das outras telas com o navegador ocioso: a proxima troca
  // de tela nao espera rede para montar.
  React.useEffect(() => precarregarTelas(), []);

  if (!user) return null;

  // Filter nav items based on role and active modules
  const filteredNavItems = navItems.filter(item => {
    // Check owner-only restriction
    if (item.ownerOnly && !isOwner) return false;
    if (item.staffOnly && isOwner) return false;
    
    // App is always available for owner and funcionario
    if (item.path === '/empresa/app' && item.alwaysShow) return true;

    // Itens marcados como alwaysShow nao dependem de modulo contratado.
    // Antes isto valia so para o dono, e por isso o funcionario nao enxergava
    // Configuracoes — a tela onde ele edita o proprio nome e e-mail.
    if (item.alwaysShow) return true;
    
    if (item.moduleCode && !hasModuleForCurrentRole(item.moduleCode)) return false;
    
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // White label: use company logo if available
  const companyLogo =
    company?.logo_url ||
    (company as any)?.logoUrl ||
    (company as any)?.company_logo_url ||
    null;
  const companyName = company?.name || user.tenantName || 'Minha Empresa';

  const estaEm = (path: string) =>
    location.pathname === path || (path !== '/empresa/dashboard' && location.pathname.startsWith(path));
  const sidebarTitle = user.name || companyName;

  return (
    <div className="relative isolate flex h-screen overflow-hidden text-foreground lg:gap-3 lg:p-3">
      <FundoVidro claro={modoClaro} />

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        // Painel de vidro solto da borda no computador (como no Glassy
        // Dashboard); no celular e a gaveta, com vidro mais fechado.
        'fixed inset-y-0 left-0 z-50 flex flex-col vidro-denso rounded-r-3xl transition-all duration-300 lg:relative lg:rounded-3xl lg:animar-entrada-lado',
        isCollapsed ? 'w-20' : 'w-72',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* User Name / Avatar */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center w-full')}>
            {companyLogo ? (
              <img 
                src={companyLogo} 
                alt={sidebarTitle} 
                className="h-8 w-8 rounded-full object-cover ring-1 ring-white/20"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/30">
                {sidebarTitle.charAt(0).toUpperCase()}
              </div>
            )}
            {!isCollapsed && (
              <span className="font-semibold text-foreground truncate max-w-[160px]">
                {sidebarTitle}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          {/* No primeiro login os modulos ainda nao chegaram: em vez de um
              menu so com "Configuracoes" que depois "pula" para o completo,
              mostra o lugar dos itens com brilho. */}
          {carregandoModulos && (
            <div role="status" aria-label="Carregando menu" className="space-y-2">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="esqueleto-vidro h-9 rounded-full" style={{ opacity: 1 - i * 0.1 }} />
              ))}
            </div>
          )}
          {!carregandoModulos && GROUP_ORDER.map((group) => {
            const items = filteredNavItems.filter((item) => item.group === group);
            if (items.length === 0) return null;
            const recolhivel = group === 'mais' && !isCollapsed;
            return (
              <div key={group} className="mb-4 last:mb-0 animate-fade-in">
                {recolhivel ? (
                  <button
                    type="button"
                    onClick={() => setMaisAberto((atual) => !atual)}
                    aria-expanded={maisAberto}
                    className="mb-1 flex w-full items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground"
                  >
                    {GROUP_LABELS[group]}
                    <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', maisAberto && 'rotate-90')} />
                  </button>
                ) : GROUP_LABELS[group] && !isCollapsed && (
                  <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {GROUP_LABELS[group]}
                  </p>
                )}
                {recolhivel && !maisAberto ? null : (
                <ul className="space-y-1">
                  {items.map((item) => {
                    const isActive = location.pathname === item.path ||
                                    (item.path !== '/empresa/dashboard' && location.pathname.startsWith(item.path));
                    return (
                      <li key={item.path}>
                        <button
                          onClick={() => {
                            navigate(item.path);
                            setIsMobileMenuOpen(false);
                          }}
                          title={isCollapsed ? item.label : undefined}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-all duration-200',
                            isActive
                              ? 'bg-white/90 text-neutral-900 shadow-lg shadow-black/30'
                              : 'text-white/65 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          <item.icon className={cn('h-5 w-5 flex-shrink-0', isCollapsed && 'mx-auto')} />
                          {!isCollapsed && <span>{item.label}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-white/10 p-4">
          <div className={cn(
            'flex items-center gap-3',
            isCollapsed && 'justify-center'
          )}>
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full gradient-primary text-sm font-semibold text-primary-foreground">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <RoleBadge role={user.role} size="sm" />
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            className={cn(
              'mt-4 w-full justify-start gap-3 text-muted-foreground hover:text-destructive',
              isCollapsed && 'justify-center'
            )}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span>Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="animar-entrada-topo mx-4 mt-4 flex h-14 shrink-0 items-center justify-between lg:mx-0 lg:mt-0 lg:rounded-2xl lg:border lg:border-border/70 lg:bg-card/80 lg:px-4 lg:shadow-card">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden items-center gap-2 sm:flex">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt={companyName}
                  className="h-5 w-5 rounded object-cover"
                />
              ) : (
                <Building2 className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-semibold">{companyName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              title={modoClaro ? 'Ativar modo escuro' : 'Ativar modo claro'}
              aria-label={modoClaro ? 'Ativar modo escuro' : 'Ativar modo claro'}
              onClick={() => setModoClaro((atual) => !atual)}
            >
              {modoClaro ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full" title="Notificações" aria-label="Notificações">
              <Bell className="h-5 w-5" />
            </Button>
            <button type="button" onClick={() => setIsMobileMenuOpen(true)} className="hidden h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground sm:flex lg:hidden">
              {user.name.charAt(0).toUpperCase()}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 pb-32 pt-5 lg:px-3 lg:pb-6 lg:pt-6">
          <ConteudoDaRota />
        </main>

        <nav
          aria-label="Atalhos"
          className="animar-entrada-baixo fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 grid h-[72px] grid-cols-5 rounded-[2rem] border border-white/10 bg-zinc-950 px-1.5 shadow-[0_14px_34px_-12px_rgba(0,0,0,0.72)] lg:hidden"
        >
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-medium transition-colors',
              isMobileMenuOpen ? 'bg-white/10 text-primary' : 'text-white/65 hover:text-white'
            )}
          >
            <Menu className="h-5 w-5" />
            Menu
          </button>
          <MobileDockItem icon={Calendar} label="Agenda" path="/empresa/agendamentos" active={estaEm('/empresa/agendamentos')} onClick={navigate} />
          <MobileDockItem icon={LayoutDashboard} label="Início" path="/empresa/dashboard" active={estaEm('/empresa/dashboard')} onClick={navigate} central />
          <MobileDockItem icon={TrendingUp} label="Financeiro" path={hasModuleForCurrentRole('finance') ? '/empresa/financeiro' : '/empresa/caixa'} active={estaEm('/empresa/financeiro') || estaEm('/empresa/caixa')} onClick={navigate} />
          <MobileDockItem icon={Users} label="Equipe" path={isOwner && hasModuleForCurrentRole('users') ? '/empresa/equipe' : '/empresa/clientes'} active={estaEm('/empresa/equipe') || estaEm('/empresa/clientes')} onClick={navigate} />
        </nav>
      </div>
    </div>
  );
};


