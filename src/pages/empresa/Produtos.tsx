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
import * as XLSX from 'xlsx';
import { Upload } from 'lucide-react';

interface Product {
  id: string;
  companyId: string;
  name: string;
  sku: string | null;
  price: number;
  stockQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductFormData {
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  isActive: boolean;
}

const defaultFormData: ProductFormData = {
  name: '',
  sku: '',
  price: 0,
  stockQuantity: 0,
  isActive: true,
};

const Produtos: React.FC = () => {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(defaultFormData);
  const [filters, setFilters] = useState<{ search?: string; is_active?: string }>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const [totalCount, setTotalCount] = useState(0);
  const [importing, setImporting] = useState(false);

  const totalPages = useMemo(() => Math.ceil(totalCount / pagination.pageSize), [totalCount, pagination.pageSize]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const result = await companyService.list('products', {
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: filters.search,
        is_active: filters.is_active,
      });
      setData(result.data || []);
      setTotalCount(result.total || 0);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [pagination.page, pagination.pageSize, filters.search, filters.is_active]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);

  const columns: Column<Product>[] = [
    { key: 'name', label: 'Nome' },
    { key: 'sku', label: 'SKU' },
    {
      key: 'price',
      label: 'Preço',
      render: (item) => formatCurrency(Number(item.price)),
    },
    {
      key: 'stockQuantity',
      label: 'Estoque',
      render: (item) => <span className={item.stockQuantity <= 0 ? 'text-destructive font-medium' : ''}>{item.stockQuantity}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (item) => <StatusBadge status={item.isActive ? 'active' : 'inactive'} />,
    },
  ];

  const handleNew = () => {
    setEditingProduct(null);
    setFormData(defaultFormData);
    setIsFormOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku || '',
      price: Number(product.price || 0),
      stockQuantity: Number(product.stockQuantity || 0),
      isActive: product.isActive,
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome do produto é obrigatório');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        sku: formData.sku.trim() || null,
        price: Number(formData.price || 0),
        stockQuantity: Number(formData.stockQuantity || 0),
        isActive: formData.isActive,
      };

      if (editingProduct) {
        await companyService.update('products', editingProduct.id, payload);
        toast.success('Produto atualizado com sucesso');
      } else {
        await companyService.create('products', payload);
        toast.success('Produto criado com sucesso');
      }

      setIsFormOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar produto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (product: Product) => {
    try {
      await companyService.remove('products', product.id);
      toast.success('Produto excluído com sucesso');
      if (data.length === 1 && pagination.page > 1) {
        setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
      } else {
        fetchProducts();
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir produto');
    }
  };

  const parseRowToProduct = (row: Record<string, unknown>) => {
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const value = row[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
      }
      return undefined;
    };

    const name = String(get('name', 'nome', 'produto') || '').trim();
    const skuRaw = get('sku', 'codigo', 'código', 'cod');
    const priceRaw = get('price', 'preco', 'preço', 'valor');
    const stockRaw = get('stock', 'estoque', 'stockquantity', 'quantidade');
    const activeRaw = get('ativo', 'isactive', 'status');

    const price = Number(String(priceRaw ?? '0').replace(',', '.'));
    const stockQuantity = Number(String(stockRaw ?? '0').replace(',', '.'));
    const isActive =
      activeRaw === undefined
        ? true
        : ['true', '1', 'ativo', 'active', 'sim', 'yes'].includes(
            String(activeRaw).trim().toLowerCase()
          );

    return {
      name,
      sku: skuRaw ? String(skuRaw).trim() : null,
      price: Number.isFinite(price) ? price : 0,
      stockQuantity: Number.isFinite(stockQuantity) ? stockQuantity : 0,
      isActive,
    };
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) {
        toast.error('Arquivo sem planilha válida');
        return;
      }

      const worksheet = workbook.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
      });

      const products = rows
        .map(parseRowToProduct)
        .filter((item) => item.name && item.price >= 0 && item.stockQuantity >= 0);

      if (products.length === 0) {
        toast.error('Nenhum produto válido encontrado no arquivo');
        return;
      }

      const result = await companyService.importProducts(products);
      toast.success(
        `Importação concluída: ${result.created} criados, ${result.updated} atualizados, ${result.skipped} ignorados`
      );
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao importar arquivo');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Cadastro de produtos e controle de estoque"
        buttonLabel="Novo Produto"
        onButtonClick={handleNew}
      />

      <div className="flex items-center gap-3">
        <Label
          htmlFor="import-products-file"
          className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary"
        >
          <Upload className="h-4 w-4" />
          {importing ? 'Importando...' : 'Importar Excel/CSV'}
        </Label>
        <Input
          id="import-products-file"
          type="file"
          accept=".csv,.xls,.xlsx"
          className="hidden"
          onChange={handleImportFile}
          disabled={importing}
        />
      </div>

      <SearchFilters
        searchValue={filters.search || ''}
        onSearchChange={(value) => {
          setPagination((prev) => ({ ...prev, page: 1 }));
          setFilters((prev) => ({ ...prev, search: value || undefined }));
        }}
        searchPlaceholder="Buscar por nome ou SKU..."
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
        emptyMessage="Nenhum produto encontrado"
      />

      <FormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
        description="Preencha os dados do produto"
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
              placeholder="Nome do produto"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              value={formData.sku}
              onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
              placeholder="Código interno"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Preço de Venda *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => setFormData((prev) => ({ ...prev, price: Number(e.target.value) || 0 }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stockQuantity">Estoque Atual</Label>
            <Input
              id="stockQuantity"
              type="number"
              min="0"
              value={formData.stockQuantity}
              onChange={(e) => setFormData((prev) => ({ ...prev, stockQuantity: Number(e.target.value) || 0 }))}
            />
          </div>

          <div className="flex items-center space-x-2 pt-7">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
            />
            <Label htmlFor="isActive">Produto ativo</Label>
          </div>
        </div>
      </FormDialog>
    </div>
  );
};

export default Produtos;
