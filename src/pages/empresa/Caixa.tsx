import React, { useState } from 'react';
import { useCompanyData } from '@/hooks/useCompanyData';
import { DataTable, Column } from '@/components/crud/DataTable';
import { PageHeader } from '@/components/crud/PageHeader';
import { SearchFilters } from '@/components/crud/SearchFilters';
import { FormDialog } from '@/components/crud/FormDialog';
import { StatusBadge } from '@/components/crud/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface CashTransaction {
  id: string;
  company_id: string;
  type: string;
  category: string | null;
  description: string;
  amount: number;
  payment_method: string | null;
  reference_type: string | null;
  reference_id: string | null;
  transaction_date: string;
  created_by: string | null;
  created_at: string;
}

const defaultTransaction: Partial<CashTransaction> = {
  type: 'entrada',
  category: 'vendas',
  description: '',
  amount: 0,
  payment_method: 'dinheiro',
  transaction_date: new Date().toISOString().split('T')[0],
};

const typeOptions = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'saida', label: 'Saída' },
];

const categoryOptions = [
  { value: 'vendas', label: 'Vendas' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'despesas', label: 'Despesas' },
  { value: 'retirada', label: 'Retirada' },
  { value: 'suprimento', label: 'Suprimento' },
  { value: 'outros', label: 'Outros' },
];

const paymentMethodOptions = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
];

const Caixa: React.FC = () => {
  const { user } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<CashTransaction>>(defaultTransaction);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [todayStats, setTodayStats] = useState({ entradas: 0, saidas: 0, saldo: 0 });

  const {
    data,
    loading,
    totalCount,
    pagination,
    setPagination,
    filters,
    setFilters,
    create,
    refresh,
  } = useCompanyData<CashTransaction>('cash_transactions', ['description'], 'created_at');

  useEffect(() => {
    const fetchTodayStats = async () => {
      if (!user?.tenantId) return;

      const today = new Date().toISOString().split('T')[0];
      
      const { data: transactions } = await (supabase
        .from('cash_transactions') as any)
        .select('type, amount')
        .eq('company_id', user.tenantId)
        .eq('transaction_date', today);

      if (transactions) {
        const entradas = transactions
          .filter((t: any) => t.type === 'entrada')
          .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        const saidas = transactions
          .filter((t: any) => t.type === 'saida')
          .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        
        setTodayStats({
          entradas,
          saidas,
          saldo: entradas - saidas,
        });
      }
    };

    fetchTodayStats();
  }, [user?.tenantId, data]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const columns: Column<CashTransaction>[] = [
    {
      key: 'transaction_date',
      label: 'Data',
      render: (item) => format(new Date(item.transaction_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
    },
    {
      key: 'type',
      label: 'Tipo',
      render: (item) => (
        <div className={`flex items-center gap-1 ${item.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
          {item.type === 'entrada' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {item.type === 'entrada' ? 'Entrada' : 'Saída'}
        </div>
      ),
    },
    { key: 'description', label: 'Descrição' },
    {
      key: 'category',
      label: 'Categoria',
      render: (item) => categoryOptions.find(c => c.value === item.category)?.label || item.category,
    },
    {
      key: 'payment_method',
      label: 'Forma Pagamento',
      render: (item) => paymentMethodOptions.find(p => p.value === item.payment_method)?.label || item.payment_method,
    },
    {
      key: 'amount',
      label: 'Valor',
      render: (item) => (
        <span className={`font-medium ${item.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
          {item.type === 'saida' ? '-' : ''}{formatCurrency(item.amount)}
        </span>
      ),
    },
  ];

  const handleNew = () => {
    setFormData({
      ...defaultTransaction,
      transaction_date: new Date().toISOString().split('T')[0],
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.description?.trim() || !formData.amount) return;

    setIsSubmitting(true);
    try {
      await create(formData);
      setIsFormOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caixa"
        description="Controle as movimentações financeiras do dia"
        buttonLabel="Nova Movimentação"
        onButtonClick={handleNew}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas Hoje</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(todayStats.entradas)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saídas Hoje</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(todayStats.saidas)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo do Dia</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${todayStats.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(todayStats.saldo)}
            </div>
          </CardContent>
        </Card>
      </div>

      <SearchFilters
        searchValue={filters.search || ''}
        onSearchChange={(value) => setFilters({ ...filters, search: value })}
        searchPlaceholder="Buscar por descrição..."
        statusOptions={typeOptions.map(t => ({ value: t.value, label: t.label }))}
        statusValue={filters.type}
        onStatusChange={(value) => setFilters({ ...filters, type: value === 'all' ? undefined : value })}
        showClear={!!filters.search || !!filters.type}
        onClear={() => setFilters({})}
      />

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        totalCount={totalCount}
        page={pagination.page}
        pageSize={pagination.pageSize}
        onPageChange={(page) => setPagination({ ...pagination, page })}
        onPageSizeChange={(pageSize) => setPagination({ ...pagination, pageSize, page: 1 })}
        canEdit={false}
        canDelete={false}
        emptyMessage="Nenhuma movimentação encontrada"
      />

      <FormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title="Nova Movimentação"
        description="Registre uma entrada ou saída no caixa"
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo *</Label>
            <Select
              value={formData.type || 'entrada'}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select
              value={formData.category || 'vendas'}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição da movimentação"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount || 0}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_method">Forma de Pagamento</Label>
            <Select
              value={formData.payment_method || 'dinheiro'}
              onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction_date">Data</Label>
            <Input
              id="transaction_date"
              type="date"
              value={formData.transaction_date || ''}
              onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
            />
          </div>
        </div>
      </FormDialog>
    </div>
  );
};

export default Caixa;
