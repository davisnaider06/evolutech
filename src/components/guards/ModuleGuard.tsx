import React from 'react';
import { useCompanyModules } from '@/hooks/useCompanyModules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ModuleGuardProps {
  moduleCode: string;
  children: React.ReactNode;
  fallbackPath?: string;
}

export const ModuleGuard: React.FC<ModuleGuardProps> = ({
  moduleCode,
  children,
  fallbackPath = '/empresa/dashboard',
}) => {
  const { hasModule, isLoading } = useCompanyModules();
  const navigate = useNavigate();

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

  if (!hasModule(moduleCode)) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>Módulo Não Disponível</CardTitle>
            <CardDescription>
              Este módulo não está ativo no seu plano atual.
              Entre em contato com o suporte para ativá-lo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate(fallbackPath)}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Dashboard
            </Button>
            <Button 
              onClick={() => navigate('/empresa/suporte')}
              className="w-full"
            >
              Solicitar Ativação
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
