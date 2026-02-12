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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShoppingCart, DollarSign, Package } from 'lucide-react';

interface Order {
  id: string;
  company_id: string;
  customer_id: string | null;
  customer_name: string | null;
  order_number: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const defaultOrder: Partial<Order> = {
  customer_name: '',
  status: 'pendente',
  payment_status: 'pendente',
  payment_method: 'dinheiro',
  subtotal: 0,
  discount: 0,
  total: 0,
  notes: '',
};

const statusOptions = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_preparo', label: 'Em Preparo' },
  { value: 'pronto', label: 'Pronto' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelado', label: 'Cancelado' },
];

const paymentStatusOptions = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'parcial', label: 'Parcial' },
];

const paymentMethodOptions = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
];

const Pedidos: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [formData, setFormData] = useState<Partial<Order>>(defaultOrder);
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
  } = useCompanyData<Order>('orders', ['customer_name'], 'created_at');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const columns: Column<Order>[] = [
    {
      key: 'order_number',
      label: 'Pedido',
      render: (item) => (
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">#{item.order_number}</span>
        </div>
      ),
    },
    {
      key: 'customer_name',
      label: 'Cliente',
      render: (item) => item.customer_name || 'Cliente não informado',
    },
    {
      key: 'created_at',
      label: 'Data',
      render: (item) => format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    },
    {
      key: 'total',
      label: 'Total',
      render: (item) => (
        <span className="font-medium">{formatCurrency(item.total)}</span>
      ),
    },
    {
      key: 'payment_status',
      label: 'Pagamento',
      render: (item) => <StatusBadge status={item.payment_status} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  const handleNew = () => {
    setEditingOrder(null);
    setFormData(defaultOrder);
    setIsFormOpen(true);
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setFormData(order);
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const orderData = {
        ...formData,
        total: (formData.subtotal || 0) - (formData.discount || 0),
      };

      if (editingOrder) {
        await update(editingOrder.id, orderData);
      } else {
        await create(orderData);
      }
      setIsFormOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (order: Order) => {
    await remove(order.id);
  };

  const calculatedTotal = (formData.subtotal || 0) - (formData.discount || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        description="Gerencie os pedidos e vendas da sua empresa"
        buttonLabel="Novo Pedido"
        onButtonClick={handleNew}
      />

      <SearchFilters
        searchValue={filters.search || ''}
        onSearchChange={(value) => setFilters({ ...filters, search: value })}
        searchPlaceholder="Buscar por cliente..."
        statusOptions={statusOptions}
        statusValue={filters.status}
        onStatusChange={(value) => setFilters({ ...filters, status: value === 'all' ? undefined : value })}
        showClear={!!filters.search || !!filters.status}
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
        emptyMessage="Nenhum pedido encontrado"
      />

      <FormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={editingOrder ? `Editar Pedido #${editingOrder.order_number}` : 'Novo Pedido'}
        description="Preencha os dados do pedido"
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        size="lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customer_name">Nome do Cliente</Label>
            <Input
              id="customer_name"
              value={formData.customer_name || ''}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              placeholder="Nome do cliente"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status do Pedido</Label>
            <Select
              value={formData.status || 'pendente'}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_status">Status Pagamento</Label>
            <Select
              value={formData.payment_status || 'pendente'}
              onValueChange={(value) => setFormData({ ...formData, payment_status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label htmlFor="subtotal">Subtotal</Label>
            <Input
              id="subtotal"
              type="number"
              step="0.01"
              min="0"
              value={formData.subtotal || 0}
              onChange={(e) => setFormData({ ...formData, subtotal: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount">Desconto</Label>
            <Input
              id="discount"
              type="number"
              step="0.01"
              min="0"
              value={formData.discount || 0}
              onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label>Total</Label>
            <div className="h-10 px-3 py-2 rounded-md border bg-muted font-medium flex items-center">
              {formatCurrency(calculatedTotal)}
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Informações adicionais sobre o pedido"
              rows={3}
            />
          </div>
        </div>
      </FormDialog>
    </div>
  );
};

export default Pedidos;
