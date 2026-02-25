import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/crud/DataTable';
import { PageHeader } from '@/components/crud/PageHeader';
import { SearchFilters } from '@/components/crud/SearchFilters';
import { FormDialog } from '@/components/crud/FormDialog';
import { StatusBadge } from '@/components/crud/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { companyService } from '@/services/company';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Customer {
  id: string;
  companyId: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  document: string;
  isActive: boolean;
}

interface CustomerHistoryResponse {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    document: string | null;
    is_active: boolean;
    created_at: string;
  };
  summary: {
    total_services: number;
    completed_services: number;
    total_orders: number;
    paid_orders: number;
    total_spent: number;
    total_spent_orders: number;
    total_spent_services: number;
  };
  frequency: {
    first_appointment_at: string | null;
    last_appointment_at: string | null;
    active_months: number;
    average_appointments_per_month: number;
    days_since_last_appointment: number | null;
  };
  favorite_professional: {
    name: string;
    attendance_count: number;
  } | null;
  services_history: Array<{
    appointment_id: string;
    service_name: string | null;
    professional_name: string | null;
    scheduled_at: string;
    status: string;
    price: number;
  }>;
  orders_history: Array<{
    order_id: string;
    status: string;
    total: number;
    created_at: string;
    updated_at: string;
  }>;
}

interface CustomerLoyaltyProfileResponse {
  profile: {
    points_balance: number;
    cashback_balance: number;
    total_points_earned: number;
    total_points_redeemed: number;
    total_cashback_earned: number;
    total_cashback_used: number;
    total_services_count: number;
  };
}

const defaultFormData: CustomerFormData = {
  name: '',
  email: '',
  phone: '',
  document: '',
  isActive: true,
};

const Clientes: React.FC = () => {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(defaultFormData);
  const [filters, setFilters] = useState<{ search?: string; is_active?: string }>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [totalCount, setTotalCount] = useState(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<CustomerHistoryResponse | null>(null);
  const [historyLoyalty, setHistoryLoyalty] = useState<CustomerLoyaltyProfileResponse | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Customer | null>(null);

  const totalPages = useMemo(() => Math.ceil(totalCount / pagination.pageSize), [totalCount, pagination.pageSize]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const result = await companyService.list('customers', {
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: filters.search,
        is_active: filters.is_active,
      });
      setData(result.data || []);
      setTotalCount(result.total || 0);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [pagination.page, pagination.pageSize, filters.search, filters.is_active]);

  const columns: Column<Customer>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'E-mail' },
    { key: 'phone', label: 'Telefone' },
    { key: 'document', label: 'CPF/CNPJ' },
    {
      key: 'isActive',
      label: 'Status',
      render: (item) => <StatusBadge status={item.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'createdAt',
      label: 'Cadastrado em',
      render: (item) => format(new Date(item.createdAt), 'dd/MM/yyyy', { locale: ptBR }),
    },
  ];

  const handleNew = () => {
    setEditingCustomer(null);
    setFormData(defaultFormData);
    setIsFormOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      document: customer.document || '',
      isActive: customer.isActive,
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        document: formData.document.trim() || null,
        isActive: formData.isActive,
      };

      if (editingCustomer) {
        await companyService.update('customers', editingCustomer.id, payload);
        toast.success('Cliente atualizado com sucesso');
      } else {
        await companyService.create('customers', payload);
        toast.success('Cliente criado com sucesso');
      }

      setIsFormOpen(false);
      fetchCustomers();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    try {
      await companyService.remove('customers', customer.id);
      toast.success('Cliente excluído com sucesso');
      if (data.length === 1 && pagination.page > 1) {
        setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
      } else {
        fetchCustomers();
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir cliente');
    }
  };

  const handleViewHistory = async (customer: Customer) => {
    setHistoryTarget(customer);
    setHistoryData(null);
    setHistoryLoyalty(null);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const [historyResult, loyaltyResult] = await Promise.all([
        companyService.customerHistory(customer.id),
        companyService.getCustomerLoyaltyProfile(customer.id),
      ]);
      setHistoryData(historyResult);
      setHistoryLoyalty(loyaltyResult);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar historico do cliente');
    } finally {
      setHistoryLoading(false);
    }
  };

  const toMoney = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    try {
      return format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch (_error) {
      return '-';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gerencie os clientes da sua empresa"
        buttonLabel="Novo Cliente"
        onButtonClick={handleNew}
      />

      <SearchFilters
        searchValue={filters.search || ''}
        onSearchChange={(value) => {
          setPagination((prev) => ({ ...prev, page: 1 }));
          setFilters((prev) => ({ ...prev, search: value || undefined }));
        }}
        searchPlaceholder="Buscar por nome, e-mail ou telefone..."
        statusOptions={[
          { value: 'true', label: 'Ativos' },
          { value: 'false', label: 'Inativos' },
        ]}
        statusValue={filters.is_active}
        onStatusChange={(value) => {
          setPagination((prev) => ({ ...prev, page: 1 }));
          setFilters((prev) => ({ ...prev, is_active: value === 'all' ? undefined : value }));
        }}
        showClear={!!filters.search || !!filters.is_active}
        onClear={() => {
          setPagination((prev) => ({ ...prev, page: 1 }));
          setFilters({});
        }}
      />

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        totalCount={totalCount}
        page={pagination.page}
        pageSize={pagination.pageSize}
        onPageChange={(page) => {
          if (page >= 1 && page <= Math.max(1, totalPages)) {
            setPagination((prev) => ({ ...prev, page }));
          }
        }}
        onPageSizeChange={(pageSize) => setPagination({ page: 1, pageSize })}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleViewHistory}
        canView
        emptyMessage="Nenhum cliente encontrado"
      />

      <FormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
        description="Preencha os dados do cliente"
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nome do cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document">CPF/CNPJ</Label>
            <Input
              id="document"
              value={formData.document}
              onChange={(e) => setFormData((prev) => ({ ...prev, document: e.target.value }))}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="flex items-center space-x-2 pt-7">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
            />
            <Label htmlFor="isActive">Cliente ativo</Label>
          </div>
        </div>
      </FormDialog>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Historico do Cliente
            </DialogTitle>
            <DialogDescription>
              {historyTarget?.name || 'Cliente'}: servicos, frequencia, barbeiro favorito e valor total gasto.
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando historico...</div>
          ) : !historyData ? (
            <div className="py-10 text-center text-muted-foreground">Nao foi possivel carregar o historico.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Valor Total Gasto</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">{toMoney(historyData.summary.total_spent)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Atendimentos</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">
                    {historyData.summary.completed_services}/{historyData.summary.total_services}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Frequencia Media</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">
                    {historyData.frequency.average_appointments_per_month.toFixed(2)}/mes
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Barbeiro Favorito</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-medium">
                    {historyData.favorite_professional
                      ? `${historyData.favorite_professional.name} (${historyData.favorite_professional.attendance_count})`
                      : '-'}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Saldo de Pontos</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">
                    {Number(historyLoyalty?.profile?.points_balance || 0).toFixed(0)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Saldo de Cashback</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">
                    {toMoney(historyLoyalty?.profile?.cashback_balance || 0)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Pontos Ganhos</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">
                    {Number(historyLoyalty?.profile?.total_points_earned || 0).toFixed(0)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cashback Ganho</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">
                    {toMoney(historyLoyalty?.profile?.total_cashback_earned || 0)}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Primeiro Atendimento</CardTitle>
                  </CardHeader>
                  <CardContent>{formatDateTime(historyData.frequency.first_appointment_at)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Ultimo Atendimento</CardTitle>
                  </CardHeader>
                  <CardContent>{formatDateTime(historyData.frequency.last_appointment_at)}</CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Servicos Anteriores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {historyData.services_history.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum servico encontrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {historyData.services_history.slice(0, 10).map((item) => (
                        <div key={item.appointment_id} className="flex items-center justify-between rounded border p-2 text-sm">
                          <div>
                            <p className="font-medium">{item.service_name || 'Servico'}</p>
                            <p className="text-muted-foreground">
                              {item.professional_name || 'Profissional'} • {formatDateTime(item.scheduled_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{toMoney(item.price)}</p>
                            <p className="text-xs text-muted-foreground">{item.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Pedidos Recentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {historyData.orders_history.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum pedido encontrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {historyData.orders_history.slice(0, 10).map((item) => (
                        <div key={item.order_id} className="flex items-center justify-between rounded border p-2 text-sm">
                          <div>
                            <p className="font-medium">Pedido #{item.order_id.slice(0, 8)}</p>
                            <p className="text-muted-foreground">{formatDateTime(item.created_at)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{toMoney(item.total)}</p>
                            <p className="text-xs text-muted-foreground">{item.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clientes;
