import React, { useEffect, useMemo, useState } from 'react';
import { requisitar } from '@/lib/rede';
import { useAtualizacaoAutomatica } from '@/hooks/useAtualizacaoAutomatica';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardMetricCard } from '@/components/dashboard/DashboardMetricCard';
import { DashboardActivityChart } from '@/components/dashboard/DashboardActivityChart';
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
  Clock3,
  Store,
  Repeat,
  Link2,
} from 'lucide-react';
import { PainelPendencias } from '@/components/notificacoes/PainelPendencias';
import { PrimeirosPassos } from '@/components/dashboard/PrimeirosPassos';
import { AtendimentosSemBaixa } from '@/components/agenda/AtendimentosSemBaixa';
import LinkDosClientes from '@/components/agenda/LinkDosClientes';
import { useCompanyModules } from '@/hooks/useCompanyModules';
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
  const { hasModuleForCurrentRole } = useCompanyModules();
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
  const [chartAppointments, setChartAppointments] = useState<Array<{ scheduledAt: string }>>([]);

  const isOwner = user?.role === 'DONO_EMPRESA';

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    [],
  );

  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem('evolutech_token');
        const response = await requisitar(`${API_COMPANY_URL}/dashboard/metrics`, {
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
        setChartAppointments(
          Array.isArray(data.recentAppointments)
            ? data.recentAppointments.map(({ scheduledAt }) => ({ scheduledAt }))
            : [],
        );
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
        // Na atualizacao automatica, falha de rede nao vira toast a cada minuto.
        if (recarga === 0) toast.error(error.message || 'Erro ao carregar métricas');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [recarga]);

  // Numeros e "ultimos agendamentos" acompanham o que o cliente marca pelo link.
  useAtualizacaoAutomatica(() => setRecarga((n) => n + 1));

  const activityByHour = useMemo(() => {
    const buckets = [8, 10, 12, 14, 16, 18, 20].map((hour) => ({
      label: `${String(hour).padStart(2, '0')}:00`,
      value: 0,
    }));

    chartAppointments.forEach(({ scheduledAt }) => {
      const hour = new Date(scheduledAt).getHours();
      const index = Math.max(0, Math.min(buckets.length - 1, Math.floor((hour - 8) / 2)));
      buckets[index].value += 1;
    });

    return buckets;
  }, [chartAppointments]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-3 sm:space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Visão geral</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.045em] sm:text-3xl">Olá, {user?.name?.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
          {isOwner
            ? `Gerencie ${company?.name || 'sua empresa'} e acompanhe os resultados`
            : 'Acesse suas tarefas e ferramentas disponíveis'}
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-card/80 px-3 py-2 text-sm shadow-card">
          <Clock3 className="h-4 w-4 text-primary" />
          <span className="font-medium">Hoje</span>
        </div>
      </section>

      {/* O que pede acao agora (agendamento novo pelo link, mensalidade em
          aberto, agenda de hoje) vem antes dos numeros. Antes este painel so
          existia em "Minhas tarefas" e o dono nao via. */}
      {/* Barbearia nova: o que falta para o link de agendamento funcionar.
          Some sozinho quando tudo estiver feito. */}
      {isOwner && <PrimeirosPassos />}

      <PainelPendencias />

      {hasModuleForCurrentRole('appointments') && <AtendimentosSemBaixa mostrarBarbeiro />}

      {/* O link do cliente fica a vista do dono: e o que ele divulga para
          a agenda encher. Antes so aparecia escondido em Agendamentos. */}
      {isOwner && hasModuleForCurrentRole('appointments') && (
        <LinkDosClientes slug={user?.tenantSlug || company?.slug} nomeEmpresa={company?.name} />
      )}

      <section className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <DashboardMetricCard
          title="Agendamentos hoje"
          value={loading ? '...' : metrics.appointmentsToday}
          detail={loading ? 'Contando horários...' : `${metrics.upcomingAppointments} ainda por vir`}
          icon={CalendarClock}
          trend={metrics.appointmentsToday > 0 ? 'up' : 'neutral'}
          trendLabel={metrics.appointmentsToday > 0 ? 'em andamento' : undefined}
        />
        <DashboardMetricCard
          title="Faturamento do mês"
          value={loading ? '...' : currency.format(metrics.revenueMonth || 0)}
          detail="Vendas pagas no mês"
          icon={Wallet}
          trend={metrics.revenueMonth > 0 ? 'up' : 'neutral'}
          trendLabel={metrics.revenueMonth > 0 ? 'mês atual' : undefined}
        />
        <DashboardMetricCard
          title="Clientes ativos"
          value={loading ? '...' : metrics.customersActive}
          detail={loading ? 'Contando clientes...' : `De ${metrics.customersTotal} cadastrados`}
          icon={UserCheck}
          trend={metrics.customersActive > 0 ? 'up' : 'neutral'}
          trendLabel={metrics.customersActive > 0 ? 'cadastros' : undefined}
        />
        <DashboardMetricCard
          title={isOwner ? 'Equipe' : 'Próximos horários'}
          value={loading ? '...' : isOwner ? metrics.employeesTotal : metrics.upcomingAppointments}
          detail={isOwner ? 'Profissionais ativos' : 'Agendamentos por atender'}
          icon={isOwner ? Users : Calendar}
        />
      </section>

      <DashboardActivityChart data={activityByHour} loading={loading} />

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <RecentActivity items={recentItems} title="Movimento recente" />

        {/* Atalhos para o que o dono faz todo dia — antes eram suporte,
            treinamentos e equipe, coisas de uma vez por mes. */}
        <Card>
          <CardHeader>
            <CardTitle>Atalhos do dia</CardTitle>
            <CardDescription>O que você mais usa na barbearia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* So o que a empresa tem ligado: com o perfil Essencial, atalho
                para Mensalidades levava a "modulo nao contratado". */}
            {[
              { to: '/empresa/agendamentos', icon: Calendar, label: 'Agenda de hoje', modulo: 'appointments' },
              { to: '/empresa/caixa', icon: Wallet, label: 'Caixa de hoje', modulo: 'cash' },
              { to: '/empresa/pdv', icon: Store, label: 'Vender produto', modulo: 'pdv' },
              { to: '/empresa/assinaturas', icon: Repeat, label: 'Mensalidades', modulo: 'subscriptions' },
              { to: '/empresa/agendamentos', icon: Link2, label: 'Link de agendamento para clientes', modulo: 'appointments' },
            ].filter((atalho) => hasModuleForCurrentRole(atalho.modulo)).map((atalho) => (
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
