import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/crud/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { companyService } from '@/services/company';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface CashEntryItem {
  item_type: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface CashEntry {
  id: string;
  customer_name: string;
  payment_method: string;
  paid_at: string;
  order_created_at: string;
  total: number;
  item_types: string[];
  items: CashEntryItem[];
  item_summary: string;
}

interface CashSummary {
  period: string;
  date_from: string;
  date_to: string;
  total_received: number;
  sales_count: number;
  average_ticket: number;
}

interface CashOverviewResponse {
  period: {
    reference_date: string;
    date_from: string;
    date_to: string;
  };
  summaries: {
    day: CashSummary;
    week: CashSummary;
    month: CashSummary;
    year: CashSummary;
  };
  selected_period: {
    total_received: number;
    sales_count: number;
    average_ticket: number;
    payment_methods: Array<{ payment_method: string; total: number }>;
    item_types: Array<{ item_type: string; count: number }>;
  };
  comparison: {
    previous_period: {
      date_from: string;
      date_to: string;
      total_received: number;
      sales_count: number;
      average_ticket: number;
      manual_entries_total: number;
      manual_exits_total: number;
    };
    deltas: {
      total_received: number;
      sales_count: number;
      average_ticket: number;
    };
  };
  rankings: {
    top_items: Array<{
      item_type: string;
      item_name: string;
      quantity: number;
      total_amount: number;
      orders_count: number;
    }>;
  };
  manual_period: {
    total_entries: number;
    total_exits: number;
    net: number;
  };
  balances: {
    opening_balance: number;
    closing_balance: number;
    sales_total: number;
    manual_entries_total: number;
    manual_exits_total: number;
  };
  entries: CashEntry[];
  total: number;
  page: number;
  pageSize: number;
}

interface ManualCashTransaction {
  id: string;
  type: string;
  category?: string | null;
  description: string;
  amount: number;
  paymentMethod?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  transactionDate: string;
  createdAt: string;
}

interface CustomerOption {
  id: string;
  name: string;
}

const paymentOptions = [
  { value: 'all', label: 'Todos pagamentos' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao', label: 'Cartao' },
  { value: 'credito', label: 'Credito' },
  { value: 'debito', label: 'Debito' },
];

const itemTypeOptions = [
  { value: 'all', label: 'Todos os itens' },
  { value: 'product', label: 'Produtos' },
  { value: 'service', label: 'Servicos' },
];

const manualTypeOptions = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saida' },
];

const manualCategoryOptions = [
  { value: 'vendas', label: 'Vendas' },
  { value: 'servicos', label: 'Servicos' },
  { value: 'despesas', label: 'Despesas' },
  { value: 'retirada', label: 'Retirada' },
  { value: 'suprimento', label: 'Suprimento' },
  { value: 'outros', label: 'Outros' },
];

const periodLabel: Record<string, string> = {
  day: 'Hoje',
  week: 'Semana',
  month: 'Mes',
  year: 'Ano',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
};

const formatPaymentMethod = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'pix') return 'PIX';
  if (normalized === 'dinheiro') return 'Dinheiro';
  if (normalized === 'cartao') return 'Cartao';
  if (normalized === 'credito') return 'Credito';
  if (normalized === 'debito') return 'Debito';
  return normalized || '-';
};

const formatItemType = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'service') return 'Servico';
  if (normalized === 'product') return 'Produto';
  return normalized || '-';
};

const formatDelta = (value: number, kind: 'currency' | 'number') => {
  const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
  if (kind === 'currency') {
    return `${prefix}${formatCurrency(Math.abs(value))}`;
  }
  return `${prefix}${Math.abs(value)}`;
};

const emptyManualForm = {
  id: '',
  type: 'entrada',
  category: 'outros',
  description: '',
  amount: 0,
  paymentMethod: 'dinheiro',
  transactionDate: new Date().toISOString().slice(0, 10),
};

const Caixa: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [manualLoading, setManualLoading] = useState(true);
  const [overview, setOverview] = useState<CashOverviewResponse | null>(null);
  const [manualTransactions, setManualTransactions] = useState<ManualCashTransaction[]>([]);
  const [manualTotal, setManualTotal] = useState(0);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [filters, setFilters] = useState({
    search: '',
    payment_method: 'all',
    item_type: 'all',
    dateFrom: '',
    dateTo: '',
    referenceDate: new Date().toISOString().slice(0, 10),
  });
  const [manualFilters, setManualFilters] = useState({
    search: '',
    type: 'all',
    category: 'all',
    payment_method: 'all',
  });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [manualPage, setManualPage] = useState(1);
  const manualPageSize = 10;

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await companyService.getCashOverview({
        search: filters.search || undefined,
        payment_method: filters.payment_method !== 'all' ? filters.payment_method : undefined,
        item_type: filters.item_type !== 'all' ? filters.item_type : undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        referenceDate: filters.referenceDate || undefined,
        page,
        pageSize,
      });
      setOverview(data);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar caixa');
    } finally {
      setLoading(false);
    }
  };

  const loadManualTransactions = async () => {
    setManualLoading(true);
    try {
      const result = await companyService.list('cash_transactions', {
        page: manualPage,
        pageSize: manualPageSize,
        orderBy: 'transactionDate',
        orderDirection: 'desc',
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        search: manualFilters.search || undefined,
        type: manualFilters.type !== 'all' ? manualFilters.type : undefined,
        category: manualFilters.category !== 'all' ? manualFilters.category : undefined,
        payment_method: manualFilters.payment_method !== 'all' ? manualFilters.payment_method : undefined,
      });
      setManualTransactions(Array.isArray(result?.data) ? result.data : []);
      setManualTotal(Number(result?.total || 0));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar movimentacoes manuais');
    } finally {
      setManualLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const result = await companyService.list('customers', {
        page: 1,
        pageSize: 200,
        is_active: 'true',
        orderBy: 'name',
      });
      setCustomers(
        (result?.data || []).map((item: any) => ({
          id: String(item.id),
          name: String(item.name || ''),
        }))
      );
    } catch (_error) {
      setCustomers([]);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [filters.search, filters.payment_method, filters.item_type, filters.dateFrom, filters.dateTo, filters.referenceDate, page]);

  useEffect(() => {
    loadManualTransactions();
  }, [filters.dateFrom, filters.dateTo, manualFilters.search, manualFilters.type, manualFilters.category, manualFilters.payment_method, manualPage]);

  useEffect(() => {
    loadCustomers();
  }, []);

  const manualSummary = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const item of manualTransactions) {
      const amount = Number(item.amount || 0);
      if (String(item.type || '').toLowerCase() === 'entrada') {
        entradas += amount;
      } else {
        saidas += amount;
      }
    }
    return {
      entradas,
      saidas,
      saldo: entradas - saidas,
    };
  }, [manualTransactions]);

  const openingBalance = Number(overview?.balances.opening_balance || 0);
  const periodSalesTotal = Number(overview?.balances.sales_total || 0);
  const periodManualEntries = Number(overview?.manual_period.total_entries || 0);
  const periodManualExits = Number(overview?.manual_period.total_exits || 0);
  const closingBalance = Number(overview?.balances.closing_balance || 0);
  const comparisonDeltaRevenue = Number(overview?.comparison.deltas.total_received || 0);
  const comparisonDeltaSales = Number(overview?.comparison.deltas.sales_count || 0);
  const comparisonDeltaTicket = Number(overview?.comparison.deltas.average_ticket || 0);

  const exportExcel = () => {
    if (!overview || (overview.entries.length === 0 && manualTransactions.length === 0)) {
      toast.error('Nao ha dados para exportar');
      return;
    }

    const summaryRows = [
      ...Object.entries(overview.summaries).map(([key, value]) => ({
        periodo: periodLabel[key] || key,
        inicio: new Date(value.date_from).toLocaleString('pt-BR'),
        fim: new Date(value.date_to).toLocaleString('pt-BR'),
        total_recebido: Number(value.total_received || 0),
        quantidade_vendas: Number(value.sales_count || 0),
        ticket_medio: Number(value.average_ticket || 0),
      })),
      {
        periodo: 'Manual',
        inicio: '',
        fim: '',
        total_recebido: Number(periodManualEntries || 0),
        quantidade_vendas: manualTransactions.length,
        ticket_medio: 0,
      },
      {
        periodo: 'Saldo inicial',
        inicio: '',
        fim: '',
        total_recebido: Number(openingBalance || 0),
        quantidade_vendas: 0,
        ticket_medio: 0,
      },
      {
        periodo: 'Saldo final',
        inicio: '',
        fim: '',
        total_recebido: Number(closingBalance || 0),
        quantidade_vendas: 0,
        ticket_medio: 0,
      },
    ];

    const entryRows = (overview?.entries || []).map((entry) => ({
      cliente: entry.customer_name,
      forma_pagamento: formatPaymentMethod(entry.payment_method),
      data_pagamento: formatDateTime(entry.paid_at),
      valor: Number(entry.total || 0),
      tipos: entry.item_types.map((item) => formatItemType(item)).join(', '),
      itens: entry.item_summary,
    }));

    const itemRows = (overview?.entries || []).flatMap((entry) =>
      entry.items.map((item) => ({
        cliente: entry.customer_name,
        data_pagamento: formatDateTime(entry.paid_at),
        tipo: formatItemType(item.item_type),
        item: item.item_name,
        quantidade: Number(item.quantity || 0),
        valor_unitario: Number(item.unit_price || 0),
        valor_total: Number(item.total_price || 0),
      }))
    );

    const manualRows = manualTransactions.map((item) => ({
      tipo: item.type,
      categoria: item.category || '',
      descricao: item.description,
      valor: Number(item.amount || 0),
      forma_pagamento: formatPaymentMethod(item.paymentMethod),
      data_movimentacao: formatDateTime(item.transactionDate),
      criado_em: formatDateTime(item.createdAt),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Metricas');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(entryRows), 'Pagamentos');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(itemRows), 'Itens');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(manualRows), 'Movimentacoes');
    XLSX.writeFile(workbook, `caixa-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Relatorio exportado');
  };

  const openCreateManualDialog = () => {
    setManualForm(emptyManualForm);
    setManualDialogOpen(true);
  };

  const openEditManualDialog = (item: ManualCashTransaction) => {
    setManualForm({
      id: item.id,
      type: item.type || 'entrada',
      category: item.category || 'outros',
      description: item.description || '',
      amount: Number(item.amount || 0),
      paymentMethod: item.paymentMethod || 'dinheiro',
      transactionDate: item.transactionDate ? String(item.transactionDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setManualDialogOpen(true);
  };

  const saveManualTransaction = async () => {
    if (!manualForm.description.trim()) {
      toast.error('Informe a descricao da movimentacao');
      return;
    }
    if (Number(manualForm.amount || 0) <= 0) {
      toast.error('Informe um valor valido');
      return;
    }

    setManualSaving(true);
    try {
      const payload = {
        type: manualForm.type,
        category: manualForm.category,
        description: manualForm.description.trim(),
        amount: Number(manualForm.amount || 0),
        paymentMethod: manualForm.paymentMethod || null,
        transaction_date: manualForm.transactionDate,
      };

      if (manualForm.id) {
        await companyService.update('cash_transactions', manualForm.id, payload);
        toast.success('Movimentacao manual atualizada');
      } else {
        await companyService.create('cash_transactions', payload);
        toast.success('Movimentacao manual registrada');
      }

      setManualDialogOpen(false);
      setManualForm(emptyManualForm);
      await loadManualTransactions();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar movimentacao');
    } finally {
      setManualSaving(false);
    }
  };

  const removeManualTransaction = async (id: string) => {
    if (!window.confirm('Deseja excluir esta movimentacao manual?')) return;
    try {
      await companyService.remove('cash_transactions', id);
      toast.success('Movimentacao manual excluida');
      await loadManualTransactions();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir movimentacao');
    }
  };

  const totalPages = Math.max(1, Math.ceil(Number(overview?.total || 0) / pageSize));
  const manualTotalPages = Math.max(1, Math.ceil(manualTotal / manualPageSize));

  return (
    <div className="space-y-6">
      <PageHeader title="Caixa" description="Recebimentos de vendas separados das movimentacoes manuais.">
        <Button variant="outline" onClick={exportExcel}>
          Exportar
        </Button>
        <Button onClick={openCreateManualDialog}>
          Nova movimentacao manual
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview
          ? (Object.entries(overview.summaries) as Array<[keyof CashOverviewResponse['summaries'], CashSummary]>).map(
              ([key, item]) => (
                <Card key={key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{periodLabel[key]}</CardTitle>
                    <CardDescription>{item.sales_count} vendas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(item.total_received)}</div>
                    <p className="text-xs text-muted-foreground">
                      Ticket medio: {formatCurrency(item.average_ticket)}
                    </p>
                  </CardContent>
                </Card>
              )
            )
          : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saldo inicial</CardTitle>
            <CardDescription>Posicao antes do inicio do periodo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${openingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(openingBalance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recebimentos de vendas</CardTitle>
            <CardDescription>Vendas pagas dentro do periodo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(periodSalesTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Entradas manuais</CardTitle>
            <CardDescription>Lancamentos manuais do periodo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(periodManualEntries)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saidas manuais</CardTitle>
            <CardDescription>Lancamentos manuais do periodo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(periodManualExits)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saldo final</CardTitle>
            <CardDescription>Saldo inicial + vendas + entradas - saidas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${closingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(closingBalance)}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Controle o periodo e refine a listagem de recebimentos.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Input
            list="cash-customers-list"
            placeholder="Buscar cliente, item ou pagamento"
            value={filters.search}
            onChange={(event) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, search: event.target.value }));
            }}
          />
          <select
            value={filters.payment_method}
            onChange={(event) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, payment_method: event.target.value }));
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {paymentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.item_type}
            onChange={(event) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, item_type: event.target.value }));
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {itemTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => {
              setPage(1);
              setManualPage(1);
              setFilters((prev) => ({ ...prev, dateFrom: event.target.value }));
            }}
          />
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(event) => {
              setPage(1);
              setManualPage(1);
              setFilters((prev) => ({ ...prev, dateTo: event.target.value }));
            }}
          />
          <Input
            type="date"
            value={filters.referenceDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, referenceDate: event.target.value }))}
          />
          <datalist id="cash-customers-list">
            {customers.map((customer) => (
              <option key={customer.id} value={customer.name} />
            ))}
          </datalist>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recebimentos de vendas</CardTitle>
            <CardDescription>
              Total recebido: {formatCurrency(overview?.selected_period.total_received || 0)} | Vendas:{' '}
              {overview?.selected_period.sales_count || 0}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando recebimentos...</p>
            ) : !overview?.entries.length ? (
              <p className="text-sm text-muted-foreground">Nenhum recebimento encontrado.</p>
            ) : (
              overview.entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-medium">{entry.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{entry.item_summary || 'Itens nao informados'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(entry.total)}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(entry.paid_at)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{formatPaymentMethod(entry.payment_method)}</Badge>
                    {entry.item_types.map((type) => (
                      <Badge key={`${entry.id}-${type}`} variant="secondary">
                        {formatItemType(type)}
                      </Badge>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {entry.items.map((item, index) => (
                      <div
                        key={`${entry.id}-${item.item_name}-${index}`}
                        className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                      >
                        <div>
                          <p>{item.item_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatItemType(item.item_type)} | Qtd: {item.quantity}
                          </p>
                        </div>
                        <p className="font-medium">{formatCurrency(item.total_price)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Pagina {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Proxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Comparativo de periodo</CardTitle>
              <CardDescription>Compara o filtro atual com o periodo imediatamente anterior.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">Periodo anterior</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(overview?.comparison.previous_period.date_from)} ate{' '}
                  {formatDateTime(overview?.comparison.previous_period.date_to)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Receita</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrency(Number(overview?.comparison.previous_period.total_received || 0))}
                </p>
                <p className={`text-xs ${comparisonDeltaRevenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Delta atual: {formatDelta(comparisonDeltaRevenue, 'currency')}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Vendas</p>
                <p className="mt-1 text-lg font-semibold">
                  {Number(overview?.comparison.previous_period.sales_count || 0)}
                </p>
                <p className={`text-xs ${comparisonDeltaSales >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Delta atual: {formatDelta(comparisonDeltaSales, 'number')}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ticket medio</p>
                <p className="mt-1 text-lg font-semibold">
                  {formatCurrency(Number(overview?.comparison.previous_period.average_ticket || 0))}
                </p>
                <p className={`text-xs ${comparisonDeltaTicket >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Delta atual: {formatDelta(comparisonDeltaTicket, 'currency')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Formas de pagamento</CardTitle>
              <CardDescription>Distribuicao das entradas de vendas no periodo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!overview?.selected_period.payment_methods.length ? (
                <p className="text-sm text-muted-foreground">Sem dados no periodo.</p>
              ) : (
                overview.selected_period.payment_methods.map((item) => (
                  <div key={item.payment_method} className="flex items-center justify-between rounded border p-3 text-sm">
                    <span>{formatPaymentMethod(item.payment_method)}</span>
                    <span className="font-medium">{formatCurrency(item.total)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mix vendido</CardTitle>
              <CardDescription>Quantas vendas tiveram servicos ou produtos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!overview?.selected_period.item_types.length ? (
                <p className="text-sm text-muted-foreground">Sem dados no periodo.</p>
              ) : (
                overview.selected_period.item_types.map((item) => (
                  <div key={item.item_type} className="flex items-center justify-between rounded border p-3 text-sm">
                    <span>{formatItemType(item.item_type)}</span>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ranking de itens</CardTitle>
              <CardDescription>Top produtos e servicos por faturamento no periodo filtrado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!overview?.rankings.top_items.length ? (
                <p className="text-sm text-muted-foreground">Sem dados no periodo.</p>
              ) : (
                overview.rankings.top_items.map((item, index) => (
                  <div key={`${item.item_type}-${item.item_name}-${index}`} className="rounded border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-muted-foreground">
                          {formatItemType(item.item_type)} | Qtd: {item.quantity} | Vendas: {item.orders_count}
                        </p>
                      </div>
                      <p className="font-semibold">{formatCurrency(item.total_amount)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimentacoes manuais</CardTitle>
          <CardDescription>Entradas e saidas lancadas manualmente, separadas dos recebimentos de vendas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Buscar descricao, categoria ou pagamento"
              value={manualFilters.search}
              onChange={(event) => {
                setManualPage(1);
                setManualFilters((prev) => ({ ...prev, search: event.target.value }));
              }}
            />
            <select
              value={manualFilters.type}
              onChange={(event) => {
                setManualPage(1);
                setManualFilters((prev) => ({ ...prev, type: event.target.value }));
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Todos os tipos</option>
              {manualTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={manualFilters.category}
              onChange={(event) => {
                setManualPage(1);
                setManualFilters((prev) => ({ ...prev, category: event.target.value }));
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Todas as categorias</option>
              {manualCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={manualFilters.payment_method}
              onChange={(event) => {
                setManualPage(1);
                setManualFilters((prev) => ({ ...prev, payment_method: event.target.value }));
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {paymentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Resultado filtrado</p>
              <p className="mt-1 text-lg font-semibold">{manualTotal} movimentacoes</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Entradas filtradas</p>
              <p className="mt-1 text-lg font-semibold text-green-600">{formatCurrency(manualSummary.entradas)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Saidas filtradas</p>
              <p className="mt-1 text-lg font-semibold text-red-600">{formatCurrency(manualSummary.saidas)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo filtrado</p>
              <p className={`mt-1 text-lg font-semibold ${manualSummary.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(manualSummary.saldo)}
              </p>
            </div>
          </div>

          {manualLoading ? (
            <p className="text-sm text-muted-foreground">Carregando movimentacoes manuais...</p>
          ) : !manualTransactions.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentacao manual encontrada.</p>
          ) : (
            manualTransactions.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.category || 'Sem categoria'} | {formatPaymentMethod(item.paymentMethod)} | {formatDateTime(item.transactionDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <Badge variant={item.type === 'entrada' ? 'default' : 'secondary'}>
                      {item.type === 'entrada' ? 'Entrada' : 'Saida'}
                    </Badge>
                    <p className="mt-1 font-semibold">{formatCurrency(Number(item.amount || 0))}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openEditManualDialog(item)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => removeManualTransaction(item.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
            ))
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Pagina {manualPage} de {manualTotalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={manualPage <= 1}
                onClick={() => setManualPage((prev) => prev - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={manualPage >= manualTotalPages}
                onClick={() => setManualPage((prev) => prev + 1)}
              >
                Proxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{manualForm.id ? 'Editar movimentacao manual' : 'Nova movimentacao manual'}</DialogTitle>
            <DialogDescription>Registre entradas e saidas que nao vieram direto de vendas do sistema.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-type">Tipo</Label>
              <select
                id="manual-type"
                value={manualForm.type}
                onChange={(event) => setManualForm((prev) => ({ ...prev, type: event.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {manualTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-category">Categoria</Label>
              <select
                id="manual-category"
                value={manualForm.category}
                onChange={(event) => setManualForm((prev) => ({ ...prev, category: event.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {manualCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="manual-description">Descricao</Label>
              <Textarea
                id="manual-description"
                value={manualForm.description}
                onChange={(event) => setManualForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-amount">Valor</Label>
              <Input
                id="manual-amount"
                type="number"
                min="0"
                step="0.01"
                value={manualForm.amount}
                onChange={(event) => setManualForm((prev) => ({ ...prev, amount: Number(event.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-payment">Forma de pagamento</Label>
              <select
                id="manual-payment"
                value={manualForm.paymentMethod}
                onChange={(event) => setManualForm((prev) => ({ ...prev, paymentMethod: event.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {paymentOptions.filter((option) => option.value !== 'all').map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-date">Data</Label>
              <Input
                id="manual-date"
                type="date"
                value={manualForm.transactionDate}
                onChange={(event) => setManualForm((prev) => ({ ...prev, transactionDate: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)} disabled={manualSaving}>
              Cancelar
            </Button>
            <Button onClick={saveManualTransaction} disabled={manualSaving}>
              {manualSaving ? 'Salvando...' : manualForm.id ? 'Atualizar movimentacao' : 'Salvar movimentacao'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Caixa;



