import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminService } from '@/services/admin';
import { CardMetrica } from '@/components/visual/CardMetrica';
import { RecentActivityRealtime } from '@/components/dashboard/RecentActivityRealtime';
import { TenantsListRealtime } from '@/components/dashboard/TenantsListRealtime';
import { 
  Building2, 
  Users, 
  CreditCard, 
  TrendingUp,
  HeadphonesIcon,
  Clock,
  Wallet,
  Package,
} from 'lucide-react';

interface DashboardStats {
  totalCompanies: number;
  activeUsers: number;
  totalMRR: number;
  openTickets: number;
  gatewaysActive: number;
  modulesActive: number;
  previousCompanies: number;
  previousUsers: number;
  previousMRR: number;
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0,
    activeUsers: 0,
    totalMRR: 0,
    openTickets: 0,
    gatewaysActive: 0,
    modulesActive: 0,
    previousCompanies: 0,
    previousUsers: 0,
    previousMRR: 0,
  });
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN_EVOLUTECH';

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const metrics = await adminService.dashboardMetrics();

      setStats({
        totalCompanies: metrics.totalCompanies || 0,
        activeUsers: metrics.activeUsers || 0,
        totalMRR: metrics.totalMRR || 0,
        openTickets: metrics.openTickets || 0,
        gatewaysActive: metrics.gatewaysActive || 0,
        modulesActive: metrics.modulesActive || 0,
        previousCompanies: Math.max(0, (metrics.totalCompanies || 0) - 2),
        previousUsers: Math.max(0, (metrics.activeUsers || 0) - 5),
        previousMRR: Math.max(0, (metrics.totalMRR || 0) - 1500),
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-card-gap pb-3 lg:space-y-5">
      <section className="pt-1">
        <h1 className="text-secao">Visão geral</h1>
        <p className="text-legenda text-muted-foreground">
          Olá, {user?.name?.split(' ')[0] || 'Admin'} ·{' '}
          {isSuperAdmin ? 'plataforma iBarber completa' : 'operações e suporte aos clientes'}
        </p>
      </section>

      {/* Sem badge de tendencia: a API nao manda o periodo anterior, e o
          "anterior" calculado aqui (total - 2, - 5, - 1500) nao e dado real. */}
      <section className="grid grid-cols-2 gap-card-gap lg:grid-cols-4 lg:gap-4">
        <CardMetrica rotulo="Empresas" valor={stats.totalCompanies} icone={Building2} tom="primary" carregando={loading} />
        <CardMetrica rotulo="Usuários ativos" valor={stats.activeUsers} icone={Users} tom="info" carregando={loading} />
        {isSuperAdmin && (
          <>
            <CardMetrica rotulo="MRR total" valor={formatCurrency(stats.totalMRR)} icone={CreditCard} tom="success" carregando={loading} />
            <CardMetrica rotulo="Gateways ativos" valor={stats.gatewaysActive} icone={Wallet} tom="accent" carregando={loading} />
          </>
        )}
        <CardMetrica rotulo="Tickets abertos" valor={stats.openTickets} icone={HeadphonesIcon} tom="accent" carregando={loading} />
        <CardMetrica rotulo="Módulos ativos" valor={stats.modulesActive} icone={Package} tom="primary" carregando={loading} />
      </section>

      {/* Main Content */}
      <div className="grid gap-card-gap lg:grid-cols-2 lg:gap-5">
        <RecentActivityRealtime />
        <TenantsListRealtime />
      </div>
    </div>
  );
};

export default AdminDashboard;
