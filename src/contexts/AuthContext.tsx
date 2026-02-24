import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserRole, AuthState, Company } from '@/types/auth';
import { toast } from 'sonner';
import { API_URL } from '@/config/api';

interface AuthContextType extends AuthState {
  login: (token: string, userData: any) => void;
  logout: () => void;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
  company: Company | null;
  getRedirectPath: () => string;
  isEvolutechUser: boolean;
  isCompanyUser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [company, setCompany] = useState<Company | null>(null);

  // Verifica se existe um token salvo ao carregar a página
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('evolutech_token');
    
    if (!token) {
      setAuthState({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      // Valida o token no backend e pega dados frescos
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        
        const userData = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name, // Backend agora retorna 'name'
            role: data.user.role as UserRole,
            tenantId: data.user.tenantId,
            tenantName: data.user.tenantName,
            tenantSlug: data.user.tenantSlug,
            avatar: null, // Avatar seria implementado via upload no futuro
            createdAt: new Date(data.user.created_at || Date.now())
        };

        setAuthState({
            user: userData,
            isAuthenticated: true,
            isLoading: false
        });

        if (data.company) {
            setCompany(data.company);
        }

      } else {
        throw new Error('Sessão expirada');
      }
    } catch (error) {
      console.error('Erro de auth:', error);
      localStorage.removeItem('evolutech_token'); // Limpa token inválido
      setAuthState({ user: null, isAuthenticated: false, isLoading: false });
      setCompany(null);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Função chamada pelo Login.tsx ao receber sucesso do backend
  const login = (token: string, userData: any) => {
    localStorage.setItem('evolutech_token', token);
    
    // Normaliza os dados para o formato do App
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
      isLoading: false
    });

    if (userData.tenantId) {
        // Se o login já retornou dados da empresa (se implementarmos isso no back), setamos aqui
        // Por enquanto deixamos null ou fazemos um fetch extra se necessário
    }
  };

  const logout = () => {
    localStorage.removeItem('evolutech_token');
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    setCompany(null);
    toast.info("Você saiu do sistema");
  };

  const getRedirectPath = useCallback(() => {
    if (!authState.user) return '/login';
    switch (authState.user.role) {
      case 'SUPER_ADMIN_EVOLUTECH': return '/admin-evolutech';
      case 'ADMIN_EVOLUTECH': return '/admin-evolutech/operacional';
      case 'DONO_EMPRESA': return '/empresa/dashboard';
      case 'FUNCIONARIO_EMPRESA': return '/empresa/app';
      default: return '/login';
    }
  }, [authState.user]);

  const hasPermission = (requiredRoles: UserRole[]) => {
      return authState.user ? requiredRoles.includes(authState.user.role) : false;
  };

  return (
    <AuthContext.Provider value={{ 
      ...authState, login, logout, hasPermission, company, getRedirectPath, 
      isEvolutechUser: ['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH'].includes(authState.user?.role || ''),
      isCompanyUser: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'].includes(authState.user?.role || '')
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
