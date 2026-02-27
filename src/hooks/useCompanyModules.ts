import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config/api';

export interface CompanyModule {
  id: string;
  codigo: string;
  nome: string;
  icone: string | null;
  allowed_roles?: string[];
  is_pro?: boolean;
}

const OWNER_DEFAULT_CODES = ['dashboard', 'reports', 'users', 'finance', 'gateways', 'commissions_owner'];

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
  customer_portal: ['customer_portal', 'portal_cliente'],
  courses: ['courses', 'cursos'],
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

export const useCompanyModules = () => {
  const { user, company, isLoading: isAuthLoading } = useAuth();
  const [modules, setModules] = useState<CompanyModule[]>([]);
  const [activeCodes, setActiveCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const resolveOwnerDefaults = useCallback(
    (input: CompanyModule[]) => {
      if (user?.role !== 'DONO_EMPRESA') return input;

      const defaultOwnerModules = OWNER_DEFAULT_CODES
        .filter((code) => !input.some((module) => module.codigo === code))
        .map((code) => ({
          id: `owner-default-${code}`,
          codigo: code,
          nome: code,
          icone: null,
          allowed_roles: ['DONO_EMPRESA'],
          is_pro: false,
        }));

      return [...input, ...defaultOwnerModules];
    },
    [user?.role]
  );

  const fetchModules = useCallback(async () => {
    const contextModules = ((company as any)?.modules || []) as CompanyModule[];
    if (contextModules.length > 0) {
      const mapped = contextModules.map((item) => ({
        id: item.id,
        codigo: (item.codigo || '').toLowerCase(),
          nome: item.nome,
          icone: item.icone || null,
          allowed_roles: item.allowed_roles || ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'],
          is_pro: Boolean(item.is_pro),
        }));
      const finalModules = resolveOwnerDefaults(mapped);
      setModules(finalModules);
      setActiveCodes(finalModules.map((m) => m.codigo));
      setIsLoading(false);
      return;
    }

    const token = localStorage.getItem('evolutech_token');
    if (!token) {
      setModules([]);
      setActiveCodes([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setModules([]);
        setActiveCodes([]);
        return;
      }

      const data = await response.json();
      const backendModules = (data?.user?.modules || data?.company?.modules || []) as CompanyModule[];
      const mapped = backendModules.map((item) => ({
        id: item.id,
        codigo: (item.codigo || '').toLowerCase(),
          nome: item.nome,
          icone: item.icone || null,
          allowed_roles: item.allowed_roles || ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'],
          is_pro: Boolean(item.is_pro),
        }));
      const finalModules = resolveOwnerDefaults(mapped);

      setModules(finalModules);
      setActiveCodes(finalModules.map((m) => m.codigo));
    } catch (error) {
      console.error('Error fetching company modules:', error);
      setModules([]);
      setActiveCodes([]);
    } finally {
      setIsLoading(false);
    }
  }, [company, resolveOwnerDefaults]);

  useEffect(() => {
    if (isAuthLoading) return;
    fetchModules();
  }, [fetchModules, isAuthLoading]);

  const hasModule = useCallback(
    (moduleCode: string): boolean => {
      const normalized = moduleCode.toLowerCase();
      const acceptedCodes = MODULE_ALIASES[normalized] || [normalized];
      return activeCodes.some((code) =>
        acceptedCodes.some((alias) => codeMatchesAlias(code || '', alias))
      );
    },
    [activeCodes]
  );

  const hasModuleForCurrentRole = useCallback(
    (moduleCode: string): boolean => {
      const normalized = moduleCode.toLowerCase();
      const acceptedCodes = MODULE_ALIASES[normalized] || [normalized];
      const currentRole = user?.role;
      if (!currentRole) return false;

      return modules.some((module) => {
        const code = String(module.codigo || '').toLowerCase();
        const codeMatch = acceptedCodes.some((alias) => codeMatchesAlias(code, alias));
        if (!codeMatch) return false;
        const allowedRoles =
          Array.isArray(module.allowed_roles) && module.allowed_roles.length > 0
            ? module.allowed_roles
            : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];
        return allowedRoles.includes(currentRole);
      });
    },
    [modules, user?.role]
  );

  const refreshModules = useCallback(() => {
    setIsLoading(true);
    fetchModules();
  }, [fetchModules]);

  return {
    modules,
    activeCodes,
    isLoading,
    hasModule,
    hasModuleForCurrentRole,
    refreshModules,
  };
};
