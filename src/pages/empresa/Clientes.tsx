import React, { useState } from 'react';
import { useCompanyData } from '@/hooks/useCompanyData';
import { DataTable, Column } from '@/components/crud/DataTable';
import { PageHeader } from '@/components/crud/PageHeader';
import { SearchFilters } from '@/components/crud/SearchFilters';
import { FormDialog } from '@/components/crud/FormDialog';
import { StatusBadge } from '@/components/crud/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Customer {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const defaultCustomer: Partial<Customer> = {
  name: '',
  email: '',
  phone: '',
  document: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  notes: '',
  is_active: true,
};

const Clientes: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>(defaultCustomer);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data,
    loading,
    totalCount,
    pagination,
    setPagination,
    filters,
    setFilters,
    create,
    update,
    remove,
  } = useCompanyData<Customer>('customers', ['name', 'email', 'phone']);

  const columns: Column<Customer>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Telefone' },
    { key: 'document', label: 'CPF/CNPJ' },
    { key: 'city', label: 'Cidade' },
    {
      key: 'is_active',
      label: 'Status',
      render: (item) => (
        <StatusBadge status={item.is_active ? 'active' : 'inactive'} />
      ),
    },
    {
      key: 'created_at',
      label: 'Cadastrado em',
      render: (item) => format(new Date(item.created_at), 'dd/MM/yyyy', { locale: ptBR }),
    },
  ];

  const handleNew = () => {
    setEditingCustomer(null);
    setFormData(defaultCustomer);
    setIsFormOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData(customer);
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name?.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingCustomer) {
        await update(editingCustomer.id, formData);
      } else {
        await create(formData);
      }
      setIsFormOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    await remove(customer.id);
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
        onSearchChange={(value) => setFilters({ ...filters, search: value })}
        searchPlaceholder="Buscar por nome, email ou telefone..."
        statusOptions={[
          { value: 'true', label: 'Ativos' },
          { value: 'false', label: 'Inativos' },
        ]}
        statusValue={filters.is_active}
        onStatusChange={(value) => setFilters({ ...filters, is_active: value === 'all' ? undefined : value })}
        showClear={!!filters.search || !!filters.is_active}
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
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="Nenhum cliente encontrado"
      />

      <FormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
        description="Preencha os dados do cliente"
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        size="lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome do cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document">CPF/CNPJ</Label>
            <Input
              id="document"
              value={formData.document || ''}
              onChange={(e) => setFormData({ ...formData, document: e.target.value })}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zip_code">CEP</Label>
            <Input
              id="zip_code"
              value={formData.zip_code || ''}
              onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
              placeholder="00000-000"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Rua, número, complemento"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={formData.city || ''}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Cidade"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <Input
              id="state"
              value={formData.state || ''}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="UF"
              maxLength={2}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Informações adicionais sobre o cliente"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2 sm:col-span-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Cliente ativo</Label>
          </div>
        </div>
      </FormDialog>
    </div>
  );
};

export default Clientes;
