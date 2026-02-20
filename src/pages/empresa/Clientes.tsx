import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/crud/DataTable';
import { PageHeader } from '@/components/crud/PageHeader';
import { SearchFilters } from '@/components/crud/SearchFilters';
import { FormDialog } from '@/components/crud/FormDialog';
import { StatusBadge } from '@/components/crud/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
    </div>
  );
};

export default Clientes;
