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

interface Product {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  cost_price: number;
  sale_price: number;
  unit: string;
  stock_quantity: number;
  min_stock: number;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

const defaultProduct: Partial<Product> = {
  name: '',
  description: '',
  sku: '',
  barcode: '',
  cost_price: 0,
  sale_price: 0,
  unit: 'un',
  stock_quantity: 0,
  min_stock: 0,
  is_active: true,
};

const Produtos: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>(defaultProduct);
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
  } = useCompanyData<Product>('products', ['name', 'sku', 'barcode']);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const columns: Column<Product>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'sku', label: 'SKU' },
    {
      key: 'cost_price',
      label: 'Custo',
      render: (item) => formatCurrency(item.cost_price),
    },
    {
      key: 'sale_price',
      label: 'Venda',
      render: (item) => formatCurrency(item.sale_price),
    },
    {
      key: 'stock_quantity',
      label: 'Estoque',
      render: (item) => (
        <span className={item.stock_quantity <= item.min_stock ? 'text-destructive font-medium' : ''}>
          {item.stock_quantity} {item.unit}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (item) => (
        <StatusBadge status={item.is_active ? 'active' : 'inactive'} />
      ),
    },
  ];

  const handleNew = () => {
    setEditingProduct(null);
    setFormData(defaultProduct);
    setIsFormOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData(product);
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name?.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await update(editingProduct.id, formData);
      } else {
        await create(formData);
      }
      setIsFormOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (product: Product) => {
    await remove(product.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Gerencie os produtos da sua empresa"
        buttonLabel="Novo Produto"
        onButtonClick={handleNew}
      />

      <SearchFilters
        searchValue={filters.search || ''}
        onSearchChange={(value) => setFilters({ ...filters, search: value })}
        searchPlaceholder="Buscar por nome, SKU ou código de barras..."
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
        emptyMessage="Nenhum produto encontrado"
      />

      <FormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
        description="Preencha os dados do produto"
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
              placeholder="Nome do produto"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sku">SKU / Código</Label>
            <Input
              id="sku"
              value={formData.sku || ''}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              placeholder="Código interno"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode">Código de Barras</Label>
            <Input
              id="barcode"
              value={formData.barcode || ''}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="EAN / GTIN"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_price">Preço de Custo</Label>
            <Input
              id="cost_price"
              type="number"
              step="0.01"
              min="0"
              value={formData.cost_price || 0}
              onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sale_price">Preço de Venda *</Label>
            <Input
              id="sale_price"
              type="number"
              step="0.01"
              min="0"
              value={formData.sale_price || 0}
              onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unidade</Label>
            <Input
              id="unit"
              value={formData.unit || 'un'}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              placeholder="un, kg, lt, etc"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock_quantity">Estoque Atual</Label>
            <Input
              id="stock_quantity"
              type="number"
              step="0.001"
              min="0"
              value={formData.stock_quantity || 0}
              onChange={(e) => setFormData({ ...formData, stock_quantity: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_stock">Estoque Mínimo</Label>
            <Input
              id="min_stock"
              type="number"
              step="0.001"
              min="0"
              value={formData.min_stock || 0}
              onChange={(e) => setFormData({ ...formData, min_stock: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição do produto"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2 sm:col-span-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Produto ativo</Label>
          </div>
        </div>
      </FormDialog>
    </div>
  );
};

export default Produtos;
