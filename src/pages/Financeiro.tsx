import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FinancialMetric, Company } from '@/types/auth';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { adminService } from '@/services/admin';
import { companyService } from '@/services/company';

const Financeiro: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<FinancialMetric[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('12');

  useEffect(() => {
    const fetchData = async () => {
      const isSuperAdmin = user?.role === 'SUPER_ADMIN_EVOLUTECH';
      const isOwner = user?.role === 'DONO_EMPRESA';
      if (!isSuperAdmin && !isOwner) {
        setMetrics([]);
        setCompanies([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const data = isSuperAdmin
          ? await adminService.financialOverview()
          : await companyService.financialOverview();
        setMetrics(data.metrics || []);
        setCompanies(data.companies || []);
      } catch (error) {
        console.error('Erro ao carregar financeiro:', error);
        setMetrics([]);
        setCompanies([]);
      }

      setIsLoading(false);
    };

    fetchData();
  }, [user?.role]);

  // Calculate financial stats
  const currentMonthMetrics = metrics.filter(m => {
    const d = new Date(m.month);
    return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
  });
  
  const prevMonthMetrics = metrics.filter(m => {
    const d = new Date(m.month);
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
  });

  const totalMrr = currentMonthMetrics.reduce((sum, m) => sum + Number(m.mrr), 0);
  const prevMrr = prevMonthMetrics.reduce((sum, m) => sum + Number(m.mrr), 0);
  const mrrGrowth = prevMrr > 0 ? ((totalMrr - prevMrr) / prevMrr) * 100 : 0;

  const totalRevenue = metrics.reduce((sum, m) => sum + Number(m.revenue), 0);
  const currentMonthRevenue = currentMonthMetrics.reduce((sum, m) => sum + Number(m.revenue), 0);
  const prevMonthRevenue = prevMonthMetrics.reduce((sum, m) => sum + Number(m.revenue), 0);
  const revenueGrowth = prevMonthRevenue > 0 ? ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

  const arpu = companies.length > 0 ? totalMrr / companies.length : 0;
  const ltv = arpu * 24; // Assuming 24 months average customer lifetime

  // Monthly data for charts
  const monthlyData = metrics.reduce((acc, metric) => {
    const monthKey = new Date(metric.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    const existing = acc.find(a => a.month === monthKey);
    if (existing) {
      existing.mrr += Number(metric.mrr);
      existing.revenue += Number(metric.revenue);
      existing.newCustomers += Number(metric.new_customers);
    } else {
      acc.push({
        month: monthKey,
        mrr: Number(metric.mrr),
        revenue: Number(metric.revenue),
        newCustomers: Number(metric.new_customers),
      });
    }
    return acc;
  }, [] as { month: string; mrr: number; revenue: number; newCustomers: number }[])
  .slice(-parseInt(period));

  // Revenue by plan
  const revenueByPlan = companies.reduce((acc, company) => {
    const existing = acc.find(a => a.plan === company.plan);
    if (existing) {
      existing.revenue += Number(company.monthly_revenue || 0);
    } else {
      acc.push({
        plan: company.plan.charAt(0).toUpperCase() + company.plan.slice(1),
        revenue: Number(company.monthly_revenue || 0),
      });
    }
    return acc;
  }, [] as { plan: string; revenue: number }[]);

  if (user?.role !== 'SUPER_ADMIN_EVOLUTECH' && user?.role !== 'DONO_EMPRESA') {
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
          <h1 className="text-2xl font-bold lg:text-3xl">Financeiro</h1>
          <p className="text-muted-foreground">
            Análise financeira e receita da plataforma
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
                <CardTitle className="text-sm font-medium text-muted-foreground">MRR Atual</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMrr)}
                </div>
                <div className={`flex items-center text-sm ${mrrGrowth >= 0 ? 'text-role-client-admin' : 'text-destructive'}`}>
                  {mrrGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(mrrGrowth).toFixed(1)}% vs mês anterior
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Receita Total</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}
                </div>
                <div className={`flex items-center text-sm ${revenueGrowth >= 0 ? 'text-role-client-admin' : 'text-destructive'}`}>
                  {revenueGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(revenueGrowth).toFixed(1)}% este mês
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">ARPU</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(arpu)}
                </div>
                <div className="text-sm text-muted-foreground">por cliente/mês</div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">LTV Estimado</CardTitle>
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ltv)}
                </div>
                <div className="text-sm text-muted-foreground">lifetime value</div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass">
              <CardHeader>
                <CardTitle>Evolução MRR vs Receita</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="colorMrrFin" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
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
                        formatter={(value: number, name: string) => [
                          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                          name === 'mrr' ? 'MRR' : 'Receita'
                        ]}
                      />
                      <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" fill="url(#colorMrrFin)" strokeWidth={2} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fill="url(#colorRevenue)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader>
                <CardTitle>Receita por Plano</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByPlan} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="plan" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
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
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Companies by Revenue */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Top Empresas por Receita</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {companies.slice(0, 10).map((company, index) => (
                  <div key={company.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{company.name}</p>
                        <Badge variant="outline" className="capitalize mt-1">{company.plan}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(company.monthly_revenue || 0))}
                      </p>
                      <p className="text-sm text-muted-foreground">/mês</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Financeiro;
