import React, { useEffect, useMemo, useState } from 'react';
import { subDays } from 'date-fns';
import {
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
  LineChart,
  Line,
} from 'recharts';
import { Calendar, DollarSign, Package, ShoppingCart, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { companyService } from '@/services/company';
import { toast } from 'sonner';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

interface FilterOption {
  id: string;
  label: string;
}

interface ReportsResponse {
  period: {
    date_from: string;
    date_to: string;
  };
  filters?: {
    customer?: string | null;
    service?: string | null;
    day?: string | null;
    period_group?: 'daily' | 'monthly' | 'yearly';
  };
  summary: {
    customers_total: number;
    products_total: number;
    new_customers: number;
    orders_total: number;
    paid_orders: number;
    appointments_total: number;
    revenue_total: number;
  };
  charts: {
    revenue_by_day: Array<{ date: string; revenue: number }>;
    revenue_by_period?: Array<{ date: string; label: string; revenue: number }>;
    orders_by_status: Array<{ status: string; value: number }>;
    appointments_by_status: Array<{ status: string; value: number }>;
    top_items: Array<{ itemType: 'product' | 'service'; itemName: string; quantity: number; revenue: number }>;
  };
}

const Relatorios: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(subDays(new Date(), 30).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [customerFilter, setCustomerFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [periodGroup, setPeriodGroup] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [customerOptions, setCustomerOptions] = useState<FilterOption[]>([]);
  const [serviceOptions, setServiceOptions] = useState<FilterOption[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = (await companyService.reportsOverview({
        dateFrom,
        dateTo,
        customer: customerFilter || undefined,
        service: serviceFilter || undefined,
        day: dayFilter || undefined,
        periodGroup,
      })) as ReportsResponse;
      setData(response);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar relatorios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [customersResult, servicesResult] = await Promise.all([
          companyService.list('customers', { page: 1, pageSize: 200, is_active: 'true', orderBy: 'name' }),
          companyService.list('appointment_services', { page: 1, pageSize: 200, is_active: 'true', orderBy: 'name' }),
        ]);

        setCustomerOptions(
          (customersResult?.data || []).map((item: any) => ({
            id: String(item.id || item.name),
            label: String(item.name || ''),
          }))
        );
        setServiceOptions(
          (servicesResult?.data || []).map((item: any) => ({
            id: String(item.id || item.name),
            label: String(item.name || ''),
          }))
        );
      } catch (_error) {
        setCustomerOptions([]);
        setServiceOptions([]);
      }
    };

    void loadFilterOptions();
  }, []);

  const clearFilters = () => {
    setDateFrom(subDays(new Date(), 30).toISOString().slice(0, 10));
    setDateTo(new Date().toISOString().slice(0, 10));
    setCustomerFilter('');
    setServiceFilter('');
    setDayFilter('');
    setPeriodGroup('daily');
  };

  const formatCurrency = useMemo(
    () =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }),
    []
  );

  const chartRevenueByDay = ((data?.charts.revenue_by_period || data?.charts.revenue_by_day) || []).map((item: any) => ({
    ...item,
    label: item.label || item.date.slice(5),
  }));

  if (!data && loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold lg:text-3xl">Relatorios</h1>
        <p className="text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Relatorios</h1>
          <p className="text-muted-foreground">Clientes, produtos, pedidos, agendamentos e faturamento por periodo</p>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <SearchableSelect
            value={customerFilter}
            onValueChange={setCustomerFilter}
            options={customerOptions.map((item) => ({ value: item.label, label: item.label }))}
            placeholder="Filtrar por cliente"
            searchPlaceholder="Buscar cliente..."
            emptyMessage="Nenhum cliente encontrado."
          />
          <SearchableSelect
            value={serviceFilter}
            onValueChange={setServiceFilter}
            options={serviceOptions.map((item) => ({ value: item.label, label: item.label }))}
            placeholder="Filtrar por serviço"
            searchPlaceholder="Buscar serviço..."
            emptyMessage="Nenhum serviço encontrado."
          />
          <Input type="date" value={dayFilter} onChange={(event) => setDayFilter(event.target.value)} />
          <select
            value={periodGroup}
            onChange={(event) => setPeriodGroup(event.target.value as 'daily' | 'monthly' | 'yearly')}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="daily">Diario</option>
            <option value="monthly">Mensal</option>
            <option value="yearly">Anual</option>
          </select>
          <div className="flex gap-2">
            <Button onClick={fetchData} disabled={loading} className="flex-1">
              {loading ? 'Atualizando...' : 'Aplicar filtro'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearFilters();
                window.setTimeout(() => void fetchData(), 0);
              }}
            >
              Limpar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
        {customerFilter ? <span className="rounded-full border border-border px-3 py-1">Cliente: {customerFilter}</span> : null}
        {serviceFilter ? <span className="rounded-full border border-border px-3 py-1">Servico: {serviceFilter}</span> : null}
        {dayFilter ? <span className="rounded-full border border-border px-3 py-1">Dia: {dayFilter}</span> : null}
        <span className="rounded-full border border-border px-3 py-1">
          Agrupamento: {periodGroup === 'yearly' ? 'Anual' : periodGroup === 'monthly' ? 'Mensal' : 'Diario'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{data?.summary.customers_total || 0}</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{data?.summary.products_total || 0}</span>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{data?.summary.orders_total || 0}</span>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary.paid_orders || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{data?.summary.appointments_total || 0}</span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">{formatCurrency.format(data?.summary.revenue_total || 0)}</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Faturamento por {periodGroup === 'yearly' ? 'ano' : periodGroup === 'monthly' ? 'mes' : 'dia'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRevenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(value) => `R$${Math.round(Number(value))}`} />
                  <Tooltip formatter={(value: number) => formatCurrency.format(value)} />
                  <Line dataKey="revenue" name="Faturamento" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos por status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data?.charts.orders_by_status || []} dataKey="value" nameKey="status" outerRadius={110}>
                    {(data?.charts.orders_by_status || []).map((entry, index) => (
                      <Cell key={`${entry.status}-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agendamentos por status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts.appointments_by_status || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Itens mais vendidos (PDV)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts.top_items || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="itemName" width={140} />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === 'revenue' ? formatCurrency.format(value) : value
                    }
                  />
                  <Bar dataKey="quantity" name="Quantidade" fill="hsl(var(--chart-2))" />
                  <Bar dataKey="revenue" name="Receita" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Relatorios;
