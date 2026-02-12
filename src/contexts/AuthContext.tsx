import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useUser, useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';
import { User as AppUser, UserRole, AuthState, Company, dbRoleToUserRole, DbRole } from '@/types/auth';

// Certifique-se que esta URL está correta e o backend está rodando
const API_URL = 'http://localhost:3001/api';

interface AuthContextType extends AuthState {
  login: () => void;
  signup: () => void;
  logout: () => Promise<void>;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
  company: Company | null;
  isEvolutechUser: boolean;
  isCompanyUser: boolean;
  getRedirectPath: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const { signOut, getToken } = useClerkAuth();
  const { openSignIn, openSignUp } = useClerk();

  const [company, setCompany] = useState<Company | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true, // Começa carregando
  });

  // Função para buscar dados do usuário no Backend
  const syncUserWithBackend = useCallback(async () => {
    if (!clerkUser) return;

    try {
      console.log('🔄 Sincronizando com Backend...');
      const token = await getToken();
      
      const response = await fetch(`${API_URL}/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Backend retornou ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Dados recebidos do Backend:', data);
      
      const userData: AppUser = {
        id: data.user.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        name: data.user.full_name || clerkUser.fullName || '',
        role: dbRoleToUserRole(data.user.role as DbRole),
        tenantId: data.user.company_id,
        tenantName: data.company?.name,
        avatar: clerkUser.imageUrl,
        createdAt: new Date(data.user.created_at || Date.now()),
      };

      setCompany(data.company || null);
      
      setAuthState({
        user: userData,
        isAuthenticated: true,
        isLoading: false,
      });

    } catch (error) {
      console.error('❌ CRÍTICO: Falha ao sincronizar usuário com o backend:', error);
      
      // AQUI ESTÁ A CORREÇÃO DO LOOP:
      // Se falhou ao pegar os dados do backend, NÃO podemos deixar o usuário "meio logado".
      // Temos que forçar o logout do Clerk para ele tentar login de novo ou ver o erro.
      await signOut(); 
      
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      setCompany(null);
      
      // Opcional: Mostrar um toast/alerta de erro aqui se tiver acesso
      alert("Erro de conexão com o servidor. Por favor, faça login novamente.");
    }
  }, [clerkUser, getToken, signOut]);

  // Efeito principal: Monitora o estado do Clerk
  useEffect(() => {
    if (!isClerkLoaded) return;

    if (isSignedIn && clerkUser) {
        // Se já temos o usuário carregado no estado local e ele é o mesmo do Clerk, paramos aqui
        // Isso evita loops de re-renderização
        if (authState.user?.email === clerkUser.primaryEmailAddress?.emailAddress && !authState.isLoading) {
            return;
        }
        
        // Se ainda não carregou ou mudou o usuário, busca no back
        setAuthState(prev => ({ ...prev, isLoading: true }));
        syncUserWithBackend();
    } else {
      // Não está logado no Clerk
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      setCompany(null);
    }
  }, [isClerkLoaded, isSignedIn, clerkUser, syncUserWithBackend]); // Removi authState.user das dependências para evitar ciclo

  // Funções auxiliares
  const login = useCallback(() => openSignIn(), [openSignIn]);
  const signup = useCallback(() => openSignUp(), [openSignUp]);
  
  const logout = useCallback(async () => {
    await signOut();
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    setCompany(null);
  }, [signOut]);

  const hasPermission = useCallback((requiredRoles: UserRole[]) => {
    if (!authState.user) return false;
    return requiredRoles.includes(authState.user.role);
  }, [authState.user]);

  const getRedirectPath = useCallback((): string => {
    if (!authState.user) return '/login';
    switch (authState.user.role) {
      case 'SUPER_ADMIN_EVOLUTECH': return '/admin-evolutech';
      case 'ADMIN_EVOLUTECH': return '/admin-evolutech/operacional';
      case 'DONO_EMPRESA': return '/empresa/dashboard';
      case 'FUNCIONARIO_EMPRESA': return '/empresa/app';
      default: return '/login';
    }
  }, [authState.user]);

  const isEvolutechUser = authState.user?.role === 'SUPER_ADMIN_EVOLUTECH' || authState.user?.role === 'ADMIN_EVOLUTECH';
  const isCompanyUser = authState.user?.role === 'DONO_EMPRESA' || authState.user?.role === 'FUNCIONARIO_EMPRESA';

  return (
    <AuthContext.Provider value={{ 
      ...authState, login, signup, logout, hasPermission, 
      company, isEvolutechUser, isCompanyUser, getRedirectPath 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};