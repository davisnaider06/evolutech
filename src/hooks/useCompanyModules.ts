import { useState, useEffect, useCallback, useMemo } from 'react';
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

// Modulos que todo DONO_EMPRESA enxerga sem depender de empresa_modulos.
// Precisa espelhar OWNER_DEFAULT_MODULES em backend/src/services/auth.service.ts:
// se um code sair de la e ficar aqui, o front torna a exibir o item.
// 'gateways' saiu da lista: agora e concedido por empresa, como os demais.
const OWNER_DEFAULT_CODES = ['dashboard', 'reports', 'users', 'permissions', 'finance', 'commissions_owner'];

const MODULE_ALIASES: Record<string, string[]> = {
  customers: ['customers', 'clientes'],
  products: ['products', 'produtos'],
  inventory: ['inventory', 'estoque'],
  appointments: ['appointments', 'agendamentos'],
  orders: ['orders', 'pedidos'],
  pdv: ['pdv', 'orders', 'pedidos'],
  // 'collections' e o codigo do modulo no catalogo; 'billing' e o nome da
  // tela. Sem ele aqui, conceder Cobrancas nao acendia o menu.
  billing: ['billing', 'collections', 'cobrancas', 'cobranca'],
  collections: ['collections', 'billing', 'cobrancas', 'cobranca'],
  cash: ['cash', 'caixa'],
  finance: ['finance', 'financeiro'],
  gateways: ['gateways', 'gateway'],
  reports: ['reports', 'relatorios'],
  commissions: ['commissions', 'comissoes', 'commissions_staff', 'commissions_owner', 'comissoes_dono'],
  subscriptions: ['subscriptions', 'assinaturas'],
  loyalty: ['loyalty', 'fidelidade'],
  users: ['users', 'equipe', 'funcionarios', 'team'],
  permissions: ['permissions', 'permissoes', 'controle_permissoes'],
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

/**
 * Lista de modulos guardada entre telas. Cada pagina monta um ModuleGuard
 * novo, e cada um buscava /auth/me de novo: era o "Verificando permissoes..."
 * de alguns segundos a cada clique no menu. Agora a primeira tela busca, as
 * outras abrem na hora, e depois de um minuto a lista e conferida de novo em
 * segundo plano — para a permissao que o dono mudou chegar ao funcionario.
 */
const MODULOS_VALIDOS_POR_MS = 60_000;
let modulosEmCache: { token: string; lista: CompanyModule[]; em: number } | null = null;
let buscaEmAndamento: { token: string; promessa: Promise<CompanyModule[] | null> } | null = null;

const buscarModulosDoBackend = (token: string): Promise<CompanyModule[] | null> => {
  if (buscaEmAndamento?.token === token) return buscaEmAndamento.promessa;
  const promessa = fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = await response.json();
      const lista = (data?.user?.modules || data?.company?.modules || []) as CompanyModule[];
      modulosEmCache = { token, lista, em: Date.now() };
      return lista;
    })
    .catch((error) => {
      console.error('Error fetching company modules:', error);
      return null;
    })
    .finally(() => {
      if (buscaEmAndamento?.promessa === promessa) buscaEmAndamento = null;
    });
  buscaEmAndamento = { token, promessa };
  return promessa;
};

const modulosGuardados = () => {
  const token = localStorage.getItem('evolutech_token');
  return token && modulosEmCache?.token === token ? modulosEmCache : null;
};

const mapearModulos = (lista: CompanyModule[], role?: string): CompanyModule[] => {
  const mapped = lista.map((item) => ({
    id: item.id,
    codigo: (item.codigo || '').toLowerCase(),
    nome: item.nome,
    icone: item.icone || null,
    allowed_roles: item.allowed_roles || ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'],
    is_pro: Boolean(item.is_pro),
  }));
  if (role !== 'DONO_EMPRESA') return mapped;

  const defaultOwnerModules = OWNER_DEFAULT_CODES
    .filter((code) => !mapped.some((module) => module.codigo === code))
    .map((code) => ({
      id: `owner-default-${code}`,
      codigo: code,
      nome: code,
      icone: null,
      allowed_roles: ['DONO_EMPRESA'],
      is_pro: false,
    }));
  return [...mapped, ...defaultOwnerModules];
};

export const useCompanyModules = () => {
  const { user, company, isLoading: isAuthLoading } = useAuth();
  // Comeca com o que ja esta guardado: a tela abre sem spinner.
  const [modules, setModules] = useState<CompanyModule[]>(() => {
    const guardados = modulosGuardados();
    return guardados ? mapearModulos(guardados.lista, user?.role) : [];
  });
  const [isLoading, setIsLoading] = useState(() => !modulosGuardados());
  const activeCodes = useMemo(() => modules.map((m) => m.codigo), [modules]);

  const fetchModules = useCallback(async () => {
    const contextModules = (((company as any)?.modules || (user as any)?.modules || []) as CompanyModule[]);
    if (contextModules.length > 0) {
      setModules(mapearModulos(contextModules, user?.role));
      setIsLoading(false);
      return;
    }

    const token = localStorage.getItem('evolutech_token');
    if (!token) {
      setModules([]);
      setIsLoading(false);
      return;
    }

    const guardados = modulosGuardados();
    if (guardados) {
      setModules(mapearModulos(guardados.lista, user?.role));
      setIsLoading(false);
      if (Date.now() - guardados.em < MODULOS_VALIDOS_POR_MS) return;
    }

    const lista = await buscarModulosDoBackend(token);
    // Falha de rede com lista guardada: fica a guardada, em vez de trancar
    // o usuario fora de todas as telas.
    if (lista) setModules(mapearModulos(lista, user?.role));
    else if (!guardados) setModules([]);
    setIsLoading(false);
  }, [company, user]);

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
    modulosEmCache = null;
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
