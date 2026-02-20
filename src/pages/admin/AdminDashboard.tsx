import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminService } from '@/services/admin';
import { StatsCardRealtime } from '@/components/dashboard/StatsCardRealtime';
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Olá, {user?.name?.split(' ')[0] || 'Admin'}
        </h1>
        <p className="text-muted-foreground">
          {isSuperAdmin 
            ? 'Visão geral completa da plataforma Evolutech' 
            : 'Gerencie operações e suporte aos clientes'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCardRealtime
          title="Total de Empresas"
          value={stats.totalCompanies}
          previousValue={stats.previousCompanies}
          icon={Building2}
          loading={loading}
        />
        <StatsCardRealtime
          title="Usuários Ativos"
          value={stats.activeUsers}
          previousValue={stats.previousUsers}
          icon={Users}
          loading={loading}
        />
        {isSuperAdmin && (
          <>
            <StatsCardRealtime
              title="MRR Total"
              value={formatCurrency(stats.totalMRR)}
              change={{ 
                value: stats.previousMRR > 0 
                  ? Number(((stats.totalMRR - stats.previousMRR) / stats.previousMRR * 100).toFixed(1))
                  : 0, 
                label: 'este mês' 
              }}
              icon={CreditCard}
              loading={loading}
            />
            <StatsCardRealtime
              title="Gateways Ativos"
              value={stats.gatewaysActive}
              icon={Wallet}
              loading={loading}
            />
          </>
        )}
        <StatsCardRealtime
          title="Tickets Abertos"
          value={stats.openTickets}
          icon={HeadphonesIcon}
          loading={loading}
        />
        <StatsCardRealtime
          title="Módulos Ativos"
          value={stats.modulesActive}
          icon={Package}
          loading={loading}
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivityRealtime />
        <TenantsListRealtime />
      </div>
    </div>
  );
};

export default AdminDashboard;
