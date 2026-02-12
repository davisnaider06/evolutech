import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { TenantsList } from '@/components/dashboard/TenantsList';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  DollarSign,
  ShieldCheck,
  Activity,
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user, hasPermission } = useAuth();

  const isSuperAdmin = hasPermission(['SUPER_ADMIN_EVOLUTECH']);
  const isEvolutechTeam = hasPermission(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']);
  const isClientAdmin = hasPermission(['DONO_EMPRESA']);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold lg:text-3xl">
          Olá, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-muted-foreground">
          {isSuperAdmin && 'Visão geral completa da plataforma Evolutech Digital'}
          {!isSuperAdmin && isEvolutechTeam && 'Gerencie os clientes e projetos da Evolutech'}
          {isClientAdmin && `Gerencie sua empresa: ${user?.tenantName}`}
          {user?.role === 'FUNCIONARIO_EMPRESA' && 'Acesse suas ferramentas e tarefas'}
        </p>
      </div>

      {/* Stats Grid - Different based on role */}
      {isEvolutechTeam && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total de Empresas"
            value="147"
            change={{ value: 12, label: 'vs mês anterior' }}
            icon={Building2}
            iconColor="text-role-client-admin"
          />
          <StatsCard
            title="Usuários Ativos"
            value="2,847"
            change={{ value: 8, label: 'vs mês anterior' }}
            icon={Users}
            iconColor="text-role-admin-evolutech"
          />
          {isSuperAdmin && (
            <>
              <StatsCard
                title="Receita Mensal"
                value="R$ 284.5K"
                change={{ value: 23, label: 'vs mês anterior' }}
                icon={DollarSign}
                iconColor="text-role-super-admin"
              />
              <StatsCard
                title="Taxa de Retenção"
                value="98.2%"
                change={{ value: 2, label: 'vs mês anterior' }}
                icon={TrendingUp}
                iconColor="text-accent"
              />
            </>
          )}
          {!isSuperAdmin && (
            <>
              <StatsCard
                title="Tickets Abertos"
                value="23"
                change={{ value: -15, label: 'vs semana anterior' }}
                icon={Activity}
                iconColor="text-role-employee"
              />
              <StatsCard
                title="SLA Cumprido"
                value="99.1%"
                change={{ value: 1, label: 'vs mês anterior' }}
                icon={ShieldCheck}
                iconColor="text-accent"
              />
            </>
          )}
        </div>
      )}

      {isClientAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Funcionários"
            value="45"
            change={{ value: 3, label: 'novos este mês' }}
            icon={Users}
            iconColor="text-role-client-admin"
          />
          <StatsCard
            title="Ativos Hoje"
            value="38"
            icon={Activity}
            iconColor="text-role-admin-evolutech"
          />
          <StatsCard
            title="Tarefas Concluídas"
            value="156"
            change={{ value: 18, label: 'vs semana anterior' }}
            icon={ShieldCheck}
            iconColor="text-accent"
          />
          <StatsCard
            title="Produtividade"
            value="94%"
            change={{ value: 5, label: 'vs mês anterior' }}
            icon={TrendingUp}
            iconColor="text-role-super-admin"
          />
        </div>
      )}

      {user?.role === 'FUNCIONARIO_EMPRESA' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatsCard
            title="Minhas Tarefas"
            value="12"
            icon={Activity}
            iconColor="text-role-employee"
          />
          <StatsCard
            title="Concluídas Hoje"
            value="5"
            icon={ShieldCheck}
            iconColor="text-role-client-admin"
          />
          <StatsCard
            title="Produtividade"
            value="87%"
            change={{ value: 3, label: 'vs semana anterior' }}
            icon={TrendingUp}
            iconColor="text-accent"
          />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity />
        {isEvolutechTeam && <TenantsList />}
        
        {(isClientAdmin || user?.role === 'FUNCIONARIO_EMPRESA') && (
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Suas Ferramentas</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { name: 'Tarefas', icon: Activity, color: 'text-role-employee' },
                { name: 'Relatórios', icon: TrendingUp, color: 'text-role-admin-evolutech' },
                { name: 'Equipe', icon: Users, color: 'text-role-client-admin' },
                { name: 'Configurações', icon: ShieldCheck, color: 'text-role-super-admin' },
              ].map((tool) => (
                <button
                  key={tool.name}
                  className="flex items-center gap-3 rounded-lg bg-secondary/30 p-4 transition-all duration-200 hover:bg-secondary/50"
                >
                  <tool.icon className={`h-5 w-5 ${tool.color}`} />
                  <span className="font-medium">{tool.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
