import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CUSTOMER_TOKEN_KEY, customerAuthService } from '@/services/customer-portal';
import { CustomerAuthCompany, CustomerAuthUser } from '@/types/customer-portal';

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
      setState({ customer: null, company: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const data = await customerAuthService.me();
      setState({
        customer: data.customer,
        company: data.company,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (_error) {
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
      setState({ customer: null, company: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback((token: string, customer: CustomerAuthUser, company: CustomerAuthCompany) => {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    setState({
      customer,
      company,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
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
