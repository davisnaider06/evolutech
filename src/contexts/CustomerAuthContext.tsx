import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CUSTOMER_TOKEN_KEY, customerAuthService } from '@/services/customer-portal';
import { CustomerAuthCompany, CustomerAuthUser } from '@/types/customer-portal';
import {
  tokenExpirado,
  credencialRecusada,
  salvarSessao,
  lerSessao,
  limparSessao,
} from '@/lib/session';

/** Ultimo /customer-auth/me bom, para o portal reabrir sem esperar a rede. */
const SESSAO_CLIENTE_KEY = 'evolutech_sessao_cliente';

interface CustomerAuthState {
  customer: CustomerAuthUser | null;
  company: CustomerAuthCompany | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface CustomerAuthContextType extends CustomerAuthState {
  login: (token: string, customer: CustomerAuthUser, company: CustomerAuthCompany) => void;
  logout: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export const CustomerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CustomerAuthState>({
    customer: null,
    company: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    if (!token) {
      limparSessao(SESSAO_CLIENTE_KEY);
      setState({ customer: null, company: null, isAuthenticated: false, isLoading: false });
      return;
    }

    // Validade vem do proprio token: sessao vencida encerra aqui, nao por
    // causa de uma falha de rede que nao tem relacao com isso.
    if (tokenExpirado(token)) {
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
      limparSessao(SESSAO_CLIENTE_KEY);
      setState({ customer: null, company: null, isAuthenticated: false, isLoading: false });
      return;
    }

    // Abre com o ultimo estado bom enquanto revalida.
    const cache = lerSessao<{ customer: any; company: any }>(SESSAO_CLIENTE_KEY);
    if (cache?.customer) {
      setState({
        customer: cache.customer,
        company: cache.company,
        isAuthenticated: true,
        isLoading: false,
      });
    }

    try {
      const data = await customerAuthService.me();
      salvarSessao(SESSAO_CLIENTE_KEY, data);
      setState({
        customer: data.customer,
        company: data.company,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      // Só credencial recusada derruba a sessao. Backend fora do ar ou app
      // aberto sem rede mantem o cliente logado com o que ja estava em cache.
      if (credencialRecusada(error)) {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        limparSessao(SESSAO_CLIENTE_KEY);
        setState({ customer: null, company: null, isAuthenticated: false, isLoading: false });
        return;
      }
      console.warn('[customer-auth] nao foi possivel revalidar agora:', error);
      setState((prev) => (prev.isLoading ? { ...prev, isLoading: false } : prev));
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback((token: string, customer: CustomerAuthUser, company: CustomerAuthCompany) => {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    salvarSessao(SESSAO_CLIENTE_KEY, { customer, company });
    setState({
      customer,
      company,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    limparSessao(SESSAO_CLIENTE_KEY);
    setState({ customer: null, company: null, isAuthenticated: false, isLoading: false });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login,
      logout,
    }),
    [state, login, logout]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
};

export const useCustomerAuth = () => {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth deve ser usado dentro de CustomerAuthProvider');
  }
  return context;
};
