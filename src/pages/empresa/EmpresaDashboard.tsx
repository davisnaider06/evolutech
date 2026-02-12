import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Users, 
  HeadphonesIcon,
  GraduationCap,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';

const EmpresaDashboard: React.FC = () => {
  const { user, company } = useAuth();

  const isOwner = user?.role === 'DONO_EMPRESA';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Olá, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground">
          {isOwner 
            ? `Gerencie ${company?.name || 'sua empresa'} e acompanhe os resultados` 
            : 'Acesse suas tarefas e ferramentas disponíveis'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isOwner && (
          <StatsCard
            title="Funcionários"
            value="0"
            change={{ value: 0, label: 'este mês' }}
            icon={Users}
          />
        )}
        <StatsCard
          title="Tickets Abertos"
          value="0"
          change={{ value: 0, label: 'esta semana' }}
          icon={HeadphonesIcon}
        />
        <StatsCard
          title="Treinamentos"
          value="0"
          change={{ value: 0, label: 'concluídos' }}
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
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity />
        
        <Card>
          <CardHeader>
            <CardTitle>Suas Ferramentas</CardTitle>
            <CardDescription>Acesse rapidamente as principais funcionalidades</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/empresa/suporte">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <HeadphonesIcon className="h-4 w-4" />
                  Abrir Ticket de Suporte
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/empresa/treinamentos">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Ver Treinamentos
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {isOwner && (
              <Link to="/empresa/usuarios">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Gerenciar Equipe
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmpresaDashboard;
