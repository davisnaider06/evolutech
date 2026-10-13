import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Wallet,
  ArrowRight,
  CalendarClock,
  Calendar,
  Store,
  Repeat,
  Link2,
} from 'lucide-react';
import { PainelPendencias } from '@/components/notificacoes/PainelPendencias';
import { toast } from 'sonner';
import { formatarDataHora } from '@/lib/horario';
import { API_URL } from '@/config/api';

interface DashboardMetricsResponse {
  company?: {
    id: string;
    name: string;
    slug: string;
  };
  summary: {
    employeesTotal: number;
    customersTotal: number;
    customersActive: number;
    appointmentsToday: number;
    upcomingAppointments: number;
    revenueMonth: number;
  };
  recentAppointments?: Array<{
    id: string;
    customerName?: string | null;
    serviceName?: string | null;
    status?: string;
    scheduledAt: string;
  }>;
  recentOrders?: Array<{
    id: string;
    customerName?: string | null;
    total: number;
    status?: string;
    createdAt: string;
  }>;
}

const API_COMPANY_URL = `${API_URL}/company`;

// Status gravados em ingles (pedido) ou sem acento (agenda) aparecem assim
// para o dono — antes a lista mostrava "(paid)" e "(concluido)".
const STATUS_PT: Record<string, string> = {
  paid: 'pago',
  pending: 'pendente',
  pending_pix: 'aguardando PIX',
  failed: 'falhou',
  concluido: 'concluído',
  no_show: 'não compareceu',
};
const statusPt = (status?: string) => STATUS_PT[String(status || '')] || status || 'pendente';

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
  const [recentItems, setRecentItems] = useState<Array<{
    id: string;
    type: 'agendamento' | 'pedido';
    description: string;
    timestamp: string;
    user: string;
  }>>([]);

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
        const appointmentItems = Array.isArray(data.recentAppointments)
          ? data.recentAppointments.map((item) => ({
              id: `appointment-${item.id}`,
              type: 'agendamento' as const,
              description: `${item.customerName || 'Cliente'} - ${item.serviceName || 'Serviço'} (${statusPt(item.status)})`,
              // Hora da barbearia: o dono e o barbeiro tem de ler o mesmo
              // horario que o cliente leu quando marcou.
              timestamp: formatarDataHora(item.scheduledAt),
              sortDate: item.scheduledAt,
              user: 'Agenda',
            }))
          : [];
        const orderItems = Array.isArray(data.recentOrders)
          ? data.recentOrders.map((item) => ({
              id: `order-${item.id}`,
              type: 'pedido' as const,
              description: `Venda para ${item.customerName || 'cliente'} - ${currency.format(Number(item.total || 0))} (${statusPt(item.status)})`,
              timestamp: formatarDataHora(item.createdAt),
              sortDate: item.createdAt,
              user: 'Vendas',
            }))
          : [];
        setRecentItems(
          [...appointmentItems, ...orderItems]
            .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
            .slice(0, 6)
            .map(({ sortDate, ...item }) => item)
        );
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

      {/* O que pede acao agora (agendamento novo pelo link, mensalidade em
          aberto, agenda de hoje) vem antes dos numeros. Antes este painel so
          existia em "Minhas tarefas" e o dono nao via. */}
      <PainelPendencias />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Agendamentos hoje"
          value={loading ? '...' : metrics.appointmentsToday}
          change={{ label: `${metrics.upcomingAppointments} ainda por vir` }}
          icon={CalendarClock}
        />
        <StatsCard
          title="Faturamento do mês"
          value={loading ? '...' : currency.format(metrics.revenueMonth || 0)}
          change={{ label: 'vendas pagas no mês' }}
          icon={Wallet}
        />
        <StatsCard
          title="Clientes ativos"
          value={loading ? '...' : metrics.customersActive}
          change={{ label: `de ${metrics.customersTotal} cadastrados` }}
          icon={UserCheck}
        />
        {isOwner && (
          <StatsCard
            title="Equipe"
            value={loading ? '...' : metrics.employeesTotal}
            change={{ label: 'profissionais ativos' }}
            icon={Users}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity items={recentItems} title="Movimento recente" />

        {/* Atalhos para o que o dono faz todo dia — antes eram suporte,
            treinamentos e equipe, coisas de uma vez por mes. */}
        <Card>
          <CardHeader>
            <CardTitle>Atalhos do dia</CardTitle>
            <CardDescription>O que você mais usa na barbearia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { to: '/empresa/agendamentos', icon: Calendar, label: 'Agenda de hoje' },
              { to: '/empresa/pdv', icon: Store, label: 'Abrir PDV (vender)' },
              { to: '/empresa/assinaturas', icon: Repeat, label: 'Mensalidades' },
              { to: '/empresa/agendamentos', icon: Link2, label: 'Link de agendamento para clientes' },
            ].map((atalho) => (
              <Link key={atalho.label} to={atalho.to} className="block">
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <atalho.icon className="h-4 w-4" />
                    {atalho.label}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmpresaDashboard;
