import React, { useEffect, useMemo, useState } from 'react';
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
  CalendarClock,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '@/config/api';

interface DashboardMetricsResponse {
  summary: {
    employeesTotal: number;
    customersTotal: number;
    customersActive: number;
    appointmentsToday: number;
    upcomingAppointments: number;
    revenueMonth: number;
  };
}

const API_COMPANY_URL = `${API_URL}/company`;

const EmpresaDashboard: React.FC = () => {
  const { user, company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetricsResponse['summary']>({
    employeesTotal: 0,
    customersTotal: 0,
    customersActive: 0,
    appointmentsToday: 0,
    upcomingAppointments: 0,
    revenueMonth: 0,
  });

  const isOwner = user?.role === 'DONO_EMPRESA';

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    [],
  );

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem('evolutech_token');
        const response = await fetch(`${API_COMPANY_URL}/dashboard/metrics`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Erro ao carregar dashboard');
        }

        const data = (await response.json()) as DashboardMetricsResponse;
        setMetrics(data.summary);
      } catch (error: any) {
        toast.error(error.message || 'Erro ao carregar métricas');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {user?.name?.split(' ')[0]}</h1>
        <p className="text-muted-foreground">
          {isOwner
            ? `Gerencie ${company?.name || 'sua empresa'} e acompanhe os resultados`
            : 'Acesse suas tarefas e ferramentas disponíveis'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isOwner && (
          <StatsCard
            title="Funcionários"
            value={loading ? '...' : metrics.employeesTotal}
            change={{ value: 0, label: 'equipe ativa' }}
            icon={Users}
          />
        )}
        <StatsCard
          title="Clientes Ativos"
          value={loading ? '...' : metrics.customersActive}
          change={{ value: 0, label: `de ${metrics.customersTotal} clientes` }}
          icon={HeadphonesIcon}
        />
        <StatsCard
          title="Agendamentos Hoje"
          value={loading ? '...' : metrics.appointmentsToday}
          change={{ value: 0, label: `${metrics.upcomingAppointments} próximos` }}
          icon={CalendarClock}
        />
        <StatsCard
          title="Faturamento do Mês"
          value={loading ? '...' : currency.format(metrics.revenueMonth || 0)}
          change={{ value: 0, label: 'receita atual' }}
          icon={CheckCircle}
        />
      </div>

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
              <Link to="/empresa/equipe">
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
