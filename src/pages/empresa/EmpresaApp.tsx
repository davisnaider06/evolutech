import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  HeadphonesIcon,
  GraduationCap,
  CheckCircle,
  ArrowRight,
  ListTodo,
} from 'lucide-react';

/**
 * App view for FUNCIONARIO_EMPRESA
 * Limited features, focused on tasks and support
 */
const EmpresaApp: React.FC = () => {
  const { user, company } = useAuth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Olá, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground">
          Bem-vindo ao sistema {company?.name || ''}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Minhas Tarefas"
          value="0"
          change={{ value: 0, label: 'pendentes' }}
          icon={ListTodo}
        />
        <StatsCard
          title="Treinamentos"
          value="0"
          change={{ value: 0, label: 'em andamento' }}
          icon={GraduationCap}
        />
        <StatsCard
          title="Tarefas Concluídas"
          value="0%"
          change={{ value: 0, label: 'este mês' }}
          icon={CheckCircle}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>Acesse suas ferramentas disponíveis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link to="/empresa/suporte">
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <HeadphonesIcon className="h-4 w-4" />
                Solicitar Suporte
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/empresa/treinamentos">
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Meus Treinamentos
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmpresaApp;
