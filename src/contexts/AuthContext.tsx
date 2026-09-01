import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserRole, AuthState, Company } from '@/types/auth';
import { toast } from 'sonner';
import { API_URL } from '@/config/api';
import {
  decodeJwt,
  tokenExpirado,
  salvarSessao,
  lerSessao,
  limparSessao,
} from '@/lib/session';

/** Ultima resposta boa de /auth/me, para reabrir o app sem esperar a rede. */
const SESSAO_CACHE_KEY = 'evolutech_sessao';

interface AuthContextType extends AuthState {
  login: (token: string, userData: any, companyData?: any) => void;
  logout: () => void;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
  company: Company | null;
  getRedirectPath: () => string;
  isEvolutechUser: boolean;
  isCompanyUser: boolean;
  /** Rebusca /auth/me. Usado depois de editar o proprio cadastro. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [company, setCompany] = useState<Company | null>(null);

  const normalizeCompany = useCallback((raw: any): Company | null => {
    if (!raw || !raw.id) return null;
    return {
      id: String(raw.id),
      name: String(raw.name || ''),
      slug: String(raw.slug || ''),
      logo_url: raw.logo_url || raw.logoUrl || raw.company_logo_url || null,
      plan: (raw.plan || 'starter') as Company['plan'],
      status: (raw.status || 'active') as Company['status'],
      monthly_revenue: Number(raw.monthly_revenue || 0),
      sistema_base_id: raw.sistema_base_id || undefined,
      created_at: raw.created_at || new Date().toISOString(),
      updated_at: raw.updated_at || new Date().toISOString(),
      employee_count: raw.employee_count !== undefined ? Number(raw.employee_count) : undefined,
    };
  }, []);

  const decodeTokenPayload = (token: string): any | null => decodeJwt(token);

  /** Derruba a sessao de verdade: token invalido ou usuario sem acesso. */
  const encerrarSessao = useCallback(() => {
    localStorage.removeItem('evolutech_token');
    limparSessao(SESSAO_CACHE_KEY);
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    setCompany(null);
  }, []);

  /** Monta o estado a partir do payload de /auth/me (fresco ou em cache). */
  const aplicarPayload = useCallback(
    (data: any) => {
      setAuthState({
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role as UserRole,
          tenantId: data.user.tenantId,
          tenantName: data.user.tenantName,
          tenantSlug: data.user.tenantSlug,
          avatar: null,
          createdAt: new Date(data.user.created_at || Date.now()),
        },
        isAuthenticated: true,
        isLoading: false,
      });
      if (data.company) setCompany(normalizeCompany(data.company));
    },
    [normalizeCompany]
  );

  // Verifica se existe um token salvo ao carregar a página.
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('evolutech_token');

    if (!token) {
      limparSessao(SESSAO_CACHE_KEY);
      setAuthState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    // Validade lida do proprio token, sem rede. Sessao vencida cai aqui, e nao
    // depois por causa de um erro de conexao que nao tem nada a ver.
    if (tokenExpirado(token)) {
      encerrarSessao();
      return;
    }

    // Abre já: primeiro o último payload bom, senão as claims do token.
    // O app da tela de inicio precisa abrir logado mesmo antes da rede subir.
    const cache = lerSessao<any>(SESSAO_CACHE_KEY);
    if (cache?.user) {
      aplicarPayload(cache);
    } else {
      const tokenData = decodeTokenPayload(token);
      if (tokenData?.userId && tokenData?.role) {
        setAuthState({
          user: {
            id: tokenData.userId,
            email: tokenData.email || '',
            name: tokenData.fullName || 'Usuário',
            role: tokenData.role as UserRole,
            tenantId: tokenData.companyId || undefined,
            tenantName: tokenData.companyName || undefined,
            tenantSlug: undefined,
            avatar: null,
            createdAt: new Date(),
          },
          isAuthenticated: true,
          isLoading: false,
        });
      }
    }

    // Revalida em segundo plano e atualiza o cache.
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        salvarSessao(SESSAO_CACHE_KEY, data);
        aplicarPayload(data);
        return;
      }

      // Só o servidor recusando a credencial encerra a sessao.
      if (response.status === 401 || response.status === 403) {
        encerrarSessao();
        return;
      }

      // 500, 502, 503: backend indisponivel. A sessao continua de pe.
      console.warn(`[auth] /auth/me respondeu ${response.status}; mantendo a sessao local`);
    } catch (error) {
      // Falha de rede — offline, backend acordando, Neon saindo da hibernacao.
      // Apagar o token aqui era o que fazia o PWA pedir login a cada abertura.
      console.warn('[auth] nao foi possivel revalidar a sessao agora:', error);
    }

    // Sem cache nem claims utilizaveis, nao ha o que exibir: sai do loading.
    setAuthState((prev) => (prev.isLoading ? { ...prev, isLoading: false } : prev));
  }, [aplicarPayload, encerrarSessao]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  /**
   * Busca /auth/me de novo e reaplica o estado e o cache de sessao.
   *
   * Sem isto a tela de Configuracoes salvava o nome no banco e continuava
   * mostrando o antigo no menu ate o proximo login.
   */
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('evolutech_token');
    if (!token) return;

    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;

    const data = await response.json();
    salvarSessao(SESSAO_CACHE_KEY, data);
    aplicarPayload(data);
  }, [aplicarPayload]);

  const login = (token: string, userData: any, companyData?: any) => {
    localStorage.setItem('evolutech_token', token);
    // O cache antigo pode ser de outro usuario; o proximo /auth/me repoe.
    limparSessao(SESSAO_CACHE_KEY);

    const normalizedUser = {
      ...userData,
      role: userData.role as UserRole,
      tenantId: userData.tenantId,
      tenantName: userData.tenantName,
      tenantSlug: userData.tenantSlug,
    };

    setAuthState({
      user: normalizedUser,
      isAuthenticated: true,
      isLoading: false,
    });

    const resolvedCompany = normalizeCompany(companyData || userData?.company);
    if (resolvedCompany) {
      setCompany(resolvedCompany);
    }
  };

  const logout = () => {
    encerrarSessao();
    toast.info('Você saiu do sistema');
  };

  const getRedirectPath = useCallback(() => {
    if (!authState.user) return '/login';
    switch (authState.user.role) {
      case 'SUPER_ADMIN_EVOLUTECH': return '/admin-evolutech';
      case 'ADMIN_EVOLUTECH': return '/admin-evolutech/operacional';
      case 'DONO_EMPRESA': return '/empresa/dashboard';
      case 'FUNCIONARIO_EMPRESA': return '/empresa/app';
      case 'CLIENTE': return '/cliente/dashboard';
      default: return '/login';
    }
  }, [authState.user]);

  const hasPermission = (requiredRoles: UserRole[]) => {
    return authState.user ? requiredRoles.includes(authState.user.role) : false;
  };

  return (
    <AuthContext.Provider value={{
      ...authState,
      login,
      logout,
      hasPermission,
      company,
      getRedirectPath,
      refreshUser,
      isEvolutechUser: ['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH'].includes(authState.user?.role || ''),
      isCompanyUser: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'].includes(authState.user?.role || ''),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;

