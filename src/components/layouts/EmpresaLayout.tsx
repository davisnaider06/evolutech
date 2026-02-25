import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyModules } from '@/hooks/useCompanyModules';
import { RoleBadge } from '@/components/RoleBadge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bell,
  HelpCircle,
  Menu,
  X,
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
  Warehouse,
  Smartphone,
  Palette,
  Gift,
  Repeat,
} from 'lucide-react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  moduleCode?: string; // If tied to a module
  ownerOnly?: boolean; // Only for DONO_EMPRESA
  alwaysShow?: boolean; // Always show regardless of modules
}

// Navigation items - dynamically filtered based on company modules
const navItems: NavItem[] = [
  // Core items
  { icon: LayoutDashboard, label: 'Dashboard', path: '/empresa/dashboard', moduleCode: 'dashboard', ownerOnly: true },
  { icon: Smartphone, label: 'Aplicativo', path: '/empresa/app', moduleCode: 'app', alwaysShow: true },
  
  // Business modules
  { icon: Users, label: 'Clientes', path: '/empresa/clientes', moduleCode: 'customers' },
  { icon: Package, label: 'Produtos', path: '/empresa/produtos', moduleCode: 'products' },
  { icon: Warehouse, label: 'Estoque', path: '/empresa/estoque', moduleCode: 'inventory' },
  { icon: Calendar, label: 'Agendamentos', path: '/empresa/agendamentos', moduleCode: 'appointments' },
  { icon: ReceiptText, label: 'PDV', path: '/empresa/pdv', moduleCode: 'pdv' },
  { icon: ReceiptText, label: 'Cobranças', path: '/empresa/cobrancas', moduleCode: 'billing' },
  { icon: ShoppingCart, label: 'Pedidos', path: '/empresa/pedidos', moduleCode: 'orders' },
  { icon: Wallet, label: 'Caixa', path: '/empresa/caixa', moduleCode: 'cash', ownerOnly: true },
  { icon: CreditCard, label: 'Financeiro', path: '/empresa/financeiro', moduleCode: 'finance', ownerOnly: true },
  { icon: Wallet, label: 'Comissoes', path: '/empresa/comissoes', moduleCode: 'commissions' },
  { icon: Gift, label: 'Fidelidade', path: '/empresa/fidelidade', moduleCode: 'loyalty', ownerOnly: true },
  { icon: Repeat, label: 'Assinaturas', path: '/empresa/assinaturas', moduleCode: 'subscriptions', ownerOnly: true },
  { icon: CreditCard, label: 'Gateways', path: '/empresa/gateways', moduleCode: 'finance', ownerOnly: true, alwaysShow: true },
  { icon: BarChart3, label: 'Relatórios', path: '/empresa/relatorios', moduleCode: 'reports', ownerOnly: true },
  
  // Team management (core for owners)
  { icon: UserPlus, label: 'Equipe', path: '/empresa/equipe', moduleCode: 'users', ownerOnly: true },
  
  // Support & Training
  { icon: HeadphonesIcon, label: 'Suporte', path: '/empresa/suporte', moduleCode: 'support' },
  { icon: GraduationCap, label: 'Treinamentos', path: '/empresa/treinamentos', moduleCode: 'training' },
  
  // Customization & Settings (always for owners)
  { icon: Palette, label: 'Personalização', path: '/empresa/personalizacao', moduleCode: 'design', ownerOnly: true, alwaysShow: true },
  { icon: Settings, label: 'Configurações', path: '/empresa/configuracoes', moduleCode: 'settings', ownerOnly: true, alwaysShow: true },
];

const MODULE_ALIASES: Record<string, string[]> = {
  customers: ['customers', 'clientes'],
  products: ['products', 'produtos'],
  inventory: ['inventory', 'estoque'],
  appointments: ['appointments', 'agendamentos'],
  orders: ['orders', 'pedidos'],
  pdv: ['pdv', 'orders', 'pedidos'],
  billing: ['billing', 'cobrancas', 'cobranca'],
  cash: ['cash', 'caixa'],
  finance: ['finance', 'financeiro'],
  gateways: ['gateways', 'gateway'],
  reports: ['reports', 'relatorios'],
  commissions: ['commissions', 'comissoes', 'commissions_staff', 'commissions_owner', 'comissoes_dono'],
  subscriptions: ['subscriptions', 'assinaturas'],
  loyalty: ['loyalty', 'fidelidade'],
  users: ['users', 'equipe', 'funcionarios', 'team'],
  support: ['support', 'suporte'],
  training: ['training', 'treinamentos'],
  dashboard: ['dashboard'],
  settings: ['settings', 'configuracoes'],
  design: ['design', 'personalizacao'],
};

const codeMatchesAlias = (rawCode: string, alias: string) => {
  const code = (rawCode || '').toLowerCase();
  const normalizedAlias = alias.toLowerCase();
  return (
    code === normalizedAlias ||
    code.startsWith(`${normalizedAlias}_`) ||
    code.startsWith(`${normalizedAlias}-`)
  );
};

const OWNER_DEFAULT_MODULES = new Set([
  'dashboard',
  'reports',
  'users',
  'finance',
  'gateways',
  'gateway',
  'commissions_owner',
  'comissoes_dono',
]);

export const EmpresaLayout: React.FC = () => {
  const { user, logout, company } = useAuth();
  const { activeCodes } = useCompanyModules();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isOwner = user?.role === 'DONO_EMPRESA';

  if (!user) return null;

  // Filter nav items based on role and active modules
  const filteredNavItems = navItems.filter(item => {
    // Check owner-only restriction
    if (item.ownerOnly && !isOwner) return false;
    
    // App is always available for owner and funcionario
    if (item.path === '/empresa/app' && item.alwaysShow) return true;

    // Always show utility items only for owners
    if (item.alwaysShow && isOwner) return true;
    
    // Check module activation (case-insensitive)
    if (item.moduleCode) {
      const acceptedCodes = MODULE_ALIASES[item.moduleCode] || [item.moduleCode];
      const isOwnerDefault = acceptedCodes.some((code) => OWNER_DEFAULT_MODULES.has(code));
      if (isOwner && isOwnerDefault) return true;

      const hasModule = activeCodes.some((code) =>
        acceptedCodes.some((alias) => codeMatchesAlias(code || '', alias))
      );
      if (!hasModule) return false;
    }
    
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // White label: use company logo if available
  const companyLogo = company?.logo_url;
  const companyName = company?.name || user.tenantName || 'Minha Empresa';
  const sidebarTitle = user.name || companyName;

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
        {/* User Name / Avatar */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center w-full')}>
            {companyLogo ? (
              <img 
                src={companyLogo} 
                alt={sidebarTitle} 
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
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
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path || 
                              (item.path !== '/empresa/dashboard' && location.pathname.startsWith(item.path));
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
                    {!isCollapsed && (
                      <span>{!isOwner && item.path === '/empresa/app' ? 'Dashboard' : item.label}</span>
                    )}
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
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{companyName}</span>
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
