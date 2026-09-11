import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Loader2 } from 'lucide-react';

export const RoleRedirect: React.FC = () => {
  const { isAuthenticated, isLoading, user, getRedirectPath } = useAuth();
  // O app instalado abre sempre em "/", inclusive no celular do cliente da
  // barbearia. Olhando so a sessao da equipe, o cliente logado caia no login
  // da equipe a cada abertura — parecia que o portal nao guardava a sessao.
  const cliente = useCustomerAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Se está carregando, não faz nada.
    if (isLoading || cliente.isLoading) return;

    if (isAuthenticated && user) {
      const path = getRedirectPath();
      console.log(`RoleRedirect: Usuário ${user.email} (${user.role}) -> ${path}`);
      navigate(path, { replace: true });
      return;
    }

    if (cliente.isAuthenticated) {
      navigate('/cliente/dashboard', { replace: true });
      return;
    }

    console.log('RoleRedirect: Não autenticado. Redirecionando para Login.');
    navigate('/login', { replace: true });
  }, [
    isLoading,
    isAuthenticated,
    user,
    navigate,
    getRedirectPath,
    cliente.isLoading,
    cliente.isAuthenticated,
  ]);

  // Renderiza o loading enquanto o useEffect decide
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Direcionando para seu painel...</p>
      </div>
    </div>
  );
};
