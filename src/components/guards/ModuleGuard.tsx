import React from 'react';
import { useCompanyModules } from '@/hooks/useCompanyModules';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ModuleGuardProps {
  moduleCode: string;
  children: React.ReactNode;
  fallbackPath?: string;
}

export const ModuleGuard: React.FC<ModuleGuardProps> = ({ moduleCode, children, fallbackPath }) => {
  const { hasModuleForCurrentRole, isLoading } = useCompanyModules();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isFuncionario = user?.role === 'FUNCIONARIO_EMPRESA';
  const resolvedFallbackPath = fallbackPath || (isFuncionario ? '/empresa/app' : '/empresa/dashboard');

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!hasModuleForCurrentRole(moduleCode)) {
    // Quem libera modulo para o funcionario e o dono, nao o suporte da
    // Evolutech. Antes o barbeiro abria chamado pedindo acesso que so o
    // dono podia dar.
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>{isFuncionario ? 'Sem acesso a esta área' : 'Módulo não contratado'}</CardTitle>
            <CardDescription>
              {isFuncionario
                ? 'O dono da empresa ainda não liberou esta área para você. Peça a ele para ativar em Permissões.'
                : 'Este módulo não está ativo no plano da sua empresa. Fale com o suporte para ativar.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button variant="outline" onClick={() => navigate(resolvedFallbackPath)} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao início
            </Button>
            {!isFuncionario && (
              <Button onClick={() => navigate('/empresa/suporte')} className="w-full">
                Pedir ativação ao suporte
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
