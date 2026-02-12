import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export const RoleRedirect: React.FC = () => {
  const { isAuthenticated, isLoading, user, getRedirectPath } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Se está carregando, não faz nada.
    if (isLoading) return;

    // Se terminou de carregar e não tem usuário, vai pro login
    if (!isAuthenticated || !user) {
      console.log('RoleRedirect: Não autenticado. Redirecionando para Login.');
      navigate('/login', { replace: true });
      return;
    }

    // Se tem usuário, calcula a rota e vai
    const path = getRedirectPath();
    console.log(`RoleRedirect: Usuário ${user.email} (${user.role}) -> ${path}`);
    navigate(path, { replace: true });

  }, [isLoading, isAuthenticated, user, navigate, getRedirectPath]);

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