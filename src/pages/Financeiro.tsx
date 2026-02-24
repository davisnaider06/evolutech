import React, { useEffect, useMemo, useState } from 'react';
import { subDays } from 'date-fns';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, CreditCard, DollarSign, PiggyBank, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Company, FinancialMetric } from '@/types/auth';
import { adminService } from '@/services/admin';
import { companyService } from '@/services/company';

interface OwnerFinancialOverview {
  period: { date_from: string; date_to: string };
  summary: {
    mrr_current: number;
    mrr_previous: number;
    mrr_growth_percent: number;
    ltv: number;
    ticket_medio: number;
    revenue_in_period: number;
    pending_amount: number;
    customers_total: number;
  };
  charts: {
    cashflow_by_day: Array<{ date: string; paid: number; pending: number }>;
    payment_methods: Array<{ payment_method: string; total: number }>;
  };
  metrics?: FinancialMetric[];
  companies?: Company[];
}

const DONUT_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

interface AdminFinancialOverview {
  metrics: FinancialMetric[];
  companies: Company[];
}

const Financeiro: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(subDays(new Date(), 180).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [ownerData, setOwnerData] = useState<OwnerFinancialOverview | null>(null);
  const [adminData, setAdminData] = useState<AdminFinancialOverview | null>(null);
  const [periodMonths, setPeriodMonths] = useState('12');

  const isSuperAdmin = user?.role === 'SUPER_ADMIN_EVOLUTECH';
  const isOwner = user?.role === 'DONO_EMPRESA';

  const currency = useMemo(
    () =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    []
  );

  const loadData = async () => {
    if (!isSuperAdmin && !isOwner) {
      setOwnerData(null);
      setAdminData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      if (isSuperAdmin) {
        const response = (await adminService.financialOverview()) as AdminFinancialOverview;
        setAdminData(response);
        setOwnerData(null);
      } else {
        const response = (await companyService.financialOverview({
          dateFrom,
          dateTo,
        })) as OwnerFinancialOverview;
        setOwnerData(response);
        setAdminData(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.role]);

  if (!isSuperAdmin && !isOwner) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Acesso nao autorizado</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isOwner && ownerData) {
    const growth = Number(ownerData.summary.mrr_growth_percent || 0);
    const cashflowSeries = ownerData.charts.cashflow_by_day.map((item) => ({
      ...item,
      label: item.date.slice(5),
    }));
    const methodLabelMap: Record<string, string> = {
      pix: 'PIX',
      credito: 'Credito',
      debito: 'Debito',
      cartao: 'Cartao',
      dinheiro: 'Dinheiro',
    };
    const paymentMethodsSeries = (ownerData.charts.payment_methods || [])
      .map((item) => ({
        ...item,
        label: methodLabelMap[String(item.payment_method || '').toLowerCase()] || item.payment_method,
      }))
      .filter((item) => Number(item.total || 0) > 0);

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold lg:text-3xl">Financeiro</h1>
            <p className="text-muted-foreground">MRR, LTV e fluxo financeiro da sua empresa</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            <Button onClick={loadData}>Aplicar filtro</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">MRR Atual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{currency.format(ownerData.summary.mrr_current || 0)}</div>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className={`mt-2 flex items-center text-sm ${growth >= 0 ? 'text-role-client-admin' : 'text-destructive'}`}>
                {growth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {Math.abs(growth).toFixed(1)}% vs mes anterior
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">LTV</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{currency.format(ownerData.summary.ltv || 0)}</div>
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Ticket Medio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{currency.format(ownerData.summary.ticket_medio || 0)}</div>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Pendencias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{currency.format(ownerData.summary.pending_amount || 0)}</div>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Fluxo Diario (pago vs pendente)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cashflowSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(value) => `R$${Math.round(Number(value))}`} />
                    <Tooltip formatter={(value: number) => currency.format(value)} />
                    <Area type="monotone" dataKey="paid" name="Pago" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.20)" />
                    <Area type="monotone" dataKey="pending" name="Pendente" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3)/0.20)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Receita por Metodo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                {paymentMethodsSeries.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Sem pagamentos pagos no periodo para detalhar por metodo.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodsSeries}
                        dataKey="total"
                        nameKey="label"
                        innerRadius={70}
                        outerRadius={115}
                        paddingAngle={3}
                      >
                        {paymentMethodsSeries.map((entry, index) => (
                          <Cell key={`${entry.payment_method}-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => currency.format(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const metrics = adminData?.metrics || [];
  const companies = adminData?.companies || [];
  const monthsLimit = Number(periodMonths || 12);
  const monthlyData = metrics
    .reduce((acc, metric) => {
      const key = new Date(metric.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const existing = acc.find((row) => row.month === key);
      if (existing) {
        existing.mrr += Number(metric.mrr || 0);
        existing.revenue += Number(metric.revenue || 0);
      } else {
        acc.push({
          month: key,
          mrr: Number(metric.mrr || 0),
          revenue: Number(metric.revenue || 0),
        });
      }
      return acc;
    }, [] as Array<{ month: string; mrr: number; revenue: number }>)
    .slice(-monthsLimit);

  const totalMrr = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].mrr : 0;
  const totalRevenue = monthlyData.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Financeiro</h1>
          <p className="text-muted-foreground">Visao financeira consolidada da plataforma</p>
        </div>
        <Input
          type="number"
          min={3}
          max={24}
          className="w-40"
          value={periodMonths}
          onChange={(event) => setPeriodMonths(event.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">MRR</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{currency.format(totalMrr)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Receita Acumulada</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{currency.format(totalRevenue)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolucao MRR e Receita</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `R$${Math.round(Number(value))}`} />
                <Tooltip formatter={(value: number) => currency.format(value)} />
                <Area type="monotone" dataKey="mrr" name="MRR" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.20)" />
                <Area type="monotone" dataKey="revenue" name="Receita" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2)/0.20)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Empresas por Receita Mensal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {companies.slice(0, 10).map((company, index) => (
            <div key={company.id} className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{company.name}</p>
                  <Badge variant="outline" className="mt-1 capitalize">
                    {company.plan}
                  </Badge>
                </div>
              </div>
              <p className="font-semibold">{currency.format(Number(company.monthly_revenue || 0))}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Financeiro;
