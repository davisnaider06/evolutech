import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { RoleBadge } from '@/components/RoleBadge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FundoVidro } from '@/components/layouts/FundoVidro';
import { ConteudoDaRota } from '@/components/layouts/ConteudoDaRota';
import { useTemaVidro } from '@/hooks/useTemaVidro';
import { precarregarTelas } from '@/lib/telas';
import { BotaoIconeCircular } from '@/components/visual/BotaoIconeCircular';
import { BarraNavegacaoMobile } from '@/components/visual/BarraNavegacaoMobile';
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  FileText,
  Bell,
  Menu,
  X,
  Blocks,
  Package,
  HeadphonesIcon,
  Rocket,
  GraduationCap,
  CreditCard,
  Wallet,
  MessageSquare,
  UserPlus,
  Bot,
  FileCheck,
  Palette,
  Moon,
  Sun,
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  superAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin-evolutech' },
  { icon: Building2, label: 'Empresas', path: '/admin-evolutech/empresas' },
  { icon: Blocks, label: 'Sistemas Base', path: '/admin-evolutech/sistemas-base' },
  { icon: Package, label: 'Módulos', path: '/admin-evolutech/modulos' },
  { icon: Users, label: 'Usuários', path: '/admin-evolutech/usuarios' },
  { icon: UserPlus, label: 'Gerenciar Usuários', path: '/admin-evolutech/gerenciar-usuarios' },
  { icon: Wallet, label: 'Gateways Pagamento', path: '/admin-evolutech/gateways', superAdminOnly: true },
  { icon: MessageSquare, label: 'WhatsApp', path: '/admin-evolutech/whatsapp', superAdminOnly: true },
  { icon: Bot, label: 'Chatbots', path: '/admin-evolutech/chatbots' },
  { icon: HeadphonesIcon, label: 'Suporte', path: '/admin-evolutech/suporte' },
  { icon: Rocket, label: 'Evoluções', path: '/admin-evolutech/evolucoes' },
  { icon: GraduationCap, label: 'Treinamentos', path: '/admin-evolutech/treinamentos' },
  { icon: BarChart3, label: 'Métricas Globais', path: '/admin-evolutech/metricas', superAdminOnly: true },
  { icon: CreditCard, label: 'Financeiro', path: '/admin-evolutech/financeiro', superAdminOnly: true },
  { icon: FileText, label: 'Logs', path: '/admin-evolutech/logs' },
  { icon: FileCheck, label: 'Verificação', path: '/admin-evolutech/verificacao' },
  { icon: Palette, label: 'Temas', path: '/admin-evolutech/temas' },
  { icon: Settings, label: 'Configurações', path: '/admin-evolutech/configuracoes' },
];

export const AdminEvolutechLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Mesmo modo claro/escuro do painel da empresa (mesma chave): claro por
  // padrao, no visual de cards brancos sobre cinza.
  const [modoClaro, setModoClaro] = useState(() => localStorage.getItem('evolutech_modo') !== 'escuro');
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

  const isSuperAdmin = user.role === 'SUPER_ADMIN_EVOLUTECH';

  // Filter nav items based on super admin status
  const filteredNavItems = navItems.filter(item => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    return true;
  });

  const estaEm = (path: string) => location.pathname === path || (path !== '/admin-evolutech' && location.pathname.startsWith(path));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
        'fixed inset-y-0 left-0 z-50 flex flex-col vidro-denso rounded-r-3xl transition-all duration-300 lg:relative lg:rounded-3xl lg:animar-entrada-lado',
        isCollapsed ? 'w-20' : 'w-72',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo - Always Evolutech for admin */}
        <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
          <Logo size="sm" showText={!isCollapsed} />
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

        {/* Admin Badge */}
        {!isCollapsed && (
          <div className="px-4 py-3 border-b border-border/60">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Painel Administrativo Evolutech
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path || 
                              (item.path !== '/admin-evolutech' && location.pathname.startsWith(item.path));
              return (
                <li key={item.path}>
                  <button
                    onClick={() => {
                      navigate(item.path);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className={cn('h-5 w-5 flex-shrink-0', isCollapsed && 'mx-auto')} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="border-t border-border/60 p-4">
          <div className={cn(
            'flex items-center gap-3',
            isCollapsed && 'justify-center'
          )}>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full gradient-primary text-sm font-semibold text-primary-foreground">
              {user.name.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <RoleBadge role={user.role} size="sm" />
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            className="mt-4 min-h-11 w-full justify-start gap-3 text-muted-foreground lg:hidden"
            onClick={() => setModoClaro((atual) => !atual)}
          >
            {modoClaro ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>{modoClaro ? 'Modo escuro' : 'Modo claro'}</span>
          </Button>
          <Button
            variant="ghost"
            className={cn(
              'mt-2 min-h-11 w-full justify-start gap-3 text-muted-foreground hover:text-destructive lg:mt-4',
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
        <header className="animar-entrada-topo flex h-[4.5rem] shrink-0 items-center justify-between gap-3 px-gutter lg:px-1">
          <Logo size="md" className="[&_span]:text-xl" />
          <div className="flex shrink-0 items-center gap-2.5">
            <BotaoIconeCircular
              rotulo={modoClaro ? 'Ativar modo escuro' : 'Ativar modo claro'}
              className="hidden lg:inline-flex"
              onClick={() => setModoClaro((atual) => !atual)}
            >
              {modoClaro ? <Moon strokeWidth={1.5} /> : <Sun strokeWidth={1.5} />}
            </BotaoIconeCircular>
            <BotaoIconeCircular rotulo="Notificações">
              <Bell strokeWidth={1.5} />
            </BotaoIconeCircular>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Abrir menu da conta"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-card lg:hidden"
            >
              {user.name.charAt(0).toUpperCase()}
            </button>
          </div>
        </header>

        <main className="pb-nav-seguro flex-1 overflow-y-auto px-gutter pt-1 lg:px-1">
          <ConteudoDaRota />
        </main>

        <BarraNavegacaoMobile
          itens={[
            { id: 'inicio', rotulo: 'Início', icone: LayoutDashboard, ativo: estaEm('/admin-evolutech'), onClick: () => navigate('/admin-evolutech') },
            { id: 'empresas', rotulo: 'Empresas', icone: Building2, ativo: estaEm('/admin-evolutech/empresas'), onClick: () => navigate('/admin-evolutech/empresas') },
            { id: 'suporte', rotulo: 'Suporte', icone: HeadphonesIcon, ativo: estaEm('/admin-evolutech/suporte'), onClick: () => navigate('/admin-evolutech/suporte') },
            { id: 'menu', rotulo: 'Menu', icone: Menu, ativo: isMobileMenuOpen, onClick: () => setIsMobileMenuOpen(true) },
          ]}
        />
      </div>
    </div>
  );
};
