import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FinancialMetric } from '@/types/auth';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(212, 95%, 68%)', 'hsl(var(--muted))'];

const MetricasGlobais: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<FinancialMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('12');
  const [planDistribution, setPlanDistribution] = useState<{ name: string; value: number }[]>([]);
  const [stats, setStats] = useState({
    totalMrr: 0,
    totalRevenue: 0,
    avgChurn: 0,
    totalUsers: 0,
    totalCompanies: 0,
    mrrGrowth: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      // Fetch financial metrics
      const { data: metricsData } = await supabase
        .from('financial_metrics')
        .select('*')
        .order('month', { ascending: true });

      // Fetch companies for plan distribution
      const { data: companiesData } = await supabase
        .from('companies')
        .select('plan, status');

      if (metricsData) {
        setMetrics(metricsData);

        // Calculate aggregated stats
        const latestMonth = metricsData.filter(m => 
          new Date(m.month).getMonth() === new Date().getMonth()
        );
        const previousMonth = metricsData.filter(m => {
          const d = new Date(m.month);
          const prev = new Date();
          prev.setMonth(prev.getMonth() - 1);
          return d.getMonth() === prev.getMonth();
        });

        const currentMrr = latestMonth.reduce((sum, m) => sum + Number(m.mrr), 0);
        const prevMrr = previousMonth.reduce((sum, m) => sum + Number(m.mrr), 0);
        const mrrGrowth = prevMrr > 0 ? ((currentMrr - prevMrr) / prevMrr) * 100 : 0;

        setStats({
          totalMrr: currentMrr,
          totalRevenue: metricsData.reduce((sum, m) => sum + Number(m.revenue), 0),
          avgChurn: metricsData.length > 0 
            ? metricsData.reduce((sum, m) => sum + Number(m.churn_rate), 0) / metricsData.length 
            : 0,
          totalUsers: latestMonth.reduce((sum, m) => sum + Number(m.active_users), 0),
          totalCompanies: companiesData?.filter(c => c.status === 'active').length || 0,
          mrrGrowth,
        });
      }

      if (companiesData) {
        const planCounts = companiesData.reduce((acc, company) => {
          acc[company.plan] = (acc[company.plan] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        setPlanDistribution([
          { name: 'Starter', value: planCounts.starter || 0 },
          { name: 'Professional', value: planCounts.professional || 0 },
          { name: 'Enterprise', value: planCounts.enterprise || 0 },
        ]);
      }

      setIsLoading(false);
    };

    fetchData();
  }, [period]);

  // Prepare chart data
  const monthlyData = metrics.reduce((acc, metric) => {
    const monthKey = new Date(metric.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    const existing = acc.find(a => a.month === monthKey);
    if (existing) {
      existing.mrr += Number(metric.mrr);
      existing.revenue += Number(metric.revenue);
      existing.churn += Number(metric.churn_rate);
      existing.users += Number(metric.active_users);
      existing.count += 1;
    } else {
      acc.push({
        month: monthKey,
        mrr: Number(metric.mrr),
        revenue: Number(metric.revenue),
        churn: Number(metric.churn_rate),
        users: Number(metric.active_users),
        count: 1,
      });
    }
    return acc;
  }, [] as { month: string; mrr: number; revenue: number; churn: number; users: number; count: number }[])
  .map(d => ({
    ...d,
    churn: d.churn / d.count, // Average churn
  }))
  .slice(-parseInt(period));

  if (user?.role !== 'SUPER_ADMIN_EVOLUTECH') {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso não autorizado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Métricas Globais</h1>
          <p className="text-muted-foreground">
            Visão geral de performance da plataforma
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="glass">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">MRR Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalMrr)}
                </div>
                <div className={`flex items-center text-sm ${stats.mrrGrowth >= 0 ? 'text-role-client-admin' : 'text-destructive'}`}>
                  {stats.mrrGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(stats.mrrGrowth).toFixed(1)}% vs mês anterior
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Empresas Ativas</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalCompanies}</div>
                <div className="text-sm text-muted-foreground">empresas na plataforma</div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Usuários Ativos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <div className="text-sm text-muted-foreground">usuários este mês</div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Churn Rate</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgChurn.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">média mensal</div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1 */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Evolução do MRR</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [
                          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                          'MRR'
                        ]}
                      />
                      <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" fill="url(#colorMrr)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Distribuição por Plano</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={planDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {planDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Receita Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [
                          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                          'Receita'
                        ]}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Taxa de Churn</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [`${value.toFixed(2)}%`, 'Churn']}
                      />
                      <Line type="monotone" dataKey="churn" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ fill: 'hsl(var(--destructive))' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default MetricasGlobais;
