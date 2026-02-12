import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireCompany?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  allowedRoles,
  requireCompany = false,
}) => {
  const { isAuthenticated, user, isLoading, getRedirectPath } = useAuth();
  const location = useLocation();

  // 1. Loading: Mostra spinner e IMPEDE qualquer redirecionamento precipitado
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // 2. Se não está autenticado ou o usuário não carregou -> Login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Verificação de Papel (Role)
  // Se o usuário tem um papel, mas não é o permitido para esta rota
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    console.warn(`Acesso negado. Role atual: ${user.role}. Necessário: ${allowedRoles.join(', ')}`);
    
    // Redireciona para a home correta do usuário para evitar ficar preso
    const redirectPath = getRedirectPath();
    
    // Proteção contra loop: Se o redirectPath for a própria página atual, manda pra raiz
    if (redirectPath === location.pathname) {
        return <Navigate to="/" replace />;
    }
    
    return <Navigate to={redirectPath} replace />;
  }

  // 4. Verificação de Empresa (Se a rota exige estar vinculado a uma empresa)
  if (requireCompany && !user.tenantId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
        <h2 className="text-2xl font-bold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Sua conta não está vinculada a nenhuma empresa no sistema.
        </p>
        <div className="flex gap-4">
            <button 
                onClick={() => window.history.back()} 
                className="text-primary hover:underline font-medium"
            >
            Voltar
            </button>
             <span className="text-muted-foreground">•</span>
            <a href="/login" className="text-primary hover:underline font-medium">Sair</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};