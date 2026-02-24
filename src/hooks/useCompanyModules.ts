import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/config/api';

export interface CompanyModule {
  id: string;
  codigo: string;
  nome: string;
  icone: string | null;
}

const OWNER_DEFAULT_CODES = ['dashboard', 'reports', 'users', 'finance', 'gateways'];

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

export const useCompanyModules = () => {
  const { user } = useAuth();
  const [modules, setModules] = useState<CompanyModule[]>([]);
  const [activeCodes, setActiveCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchModules = useCallback(async () => {
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
      }));

      const defaultOwnerModules =
        user?.role === 'DONO_EMPRESA'
          ? OWNER_DEFAULT_CODES
              .filter((code) => !mapped.some((module) => module.codigo === code))
              .map((code) => ({
                id: `owner-default-${code}`,
                codigo: code,
                nome: code,
                icone: null,
              }))
          : [];

      const finalModules = [...mapped, ...defaultOwnerModules];

      setModules(finalModules);
      setActiveCodes(finalModules.map((m) => m.codigo));
    } catch (error) {
      console.error('Error fetching company modules:', error);
      setModules([]);
      setActiveCodes([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

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

  const refreshModules = useCallback(() => {
    setIsLoading(true);
    fetchModules();
  }, [fetchModules]);

  return {
    modules,
    activeCodes,
    isLoading,
    hasModule,
    refreshModules,
  };
};
