import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { RoleBadge } from '@/components/RoleBadge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  HelpCircle,
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

  if (!user) return null;

  const isSuperAdmin = user.role === 'SUPER_ADMIN_EVOLUTECH';

  // Filter nav items based on super admin status
  const filteredNavItems = navItems.filter(item => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar transition-all duration-300 lg:relative',
        isCollapsed ? 'w-20' : 'w-72',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo - Always Evolutech for admin */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
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
          <div className="px-4 py-3 border-b border-border">
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
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
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
        <div className="border-t border-border p-4">
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
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card/50 px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
              <span className="text-sm font-medium text-primary">Evolutech Digital</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            </Button>
            <Button variant="ghost" size="icon">
              <HelpCircle className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
