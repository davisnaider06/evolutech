import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DataTable, Column } from '@/components/crud/DataTable';
import { PageHeader } from '@/components/crud/PageHeader';
import { SearchFilters } from '@/components/crud/SearchFilters';
import { StatusBadge } from '@/components/crud/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShoppingCart } from 'lucide-react';
import SalesByCustomerReport from '@/components/crud/SalesByCustomerReport';
import { companyService } from '@/services/company';

/**
 * Historico das vendas.
 *
 * Esta tela lia e gravava numa tabela `orders` do Supabase, banco separado
 * que o resto do sistema nao usa: o que o PDV vendia nao aparecia aqui, e o
 * pedido "criado" aqui nao entrava no caixa nem no faturamento. Agora ela le
 * as vendas de verdade (PDV, cobranca, mensalidade) da API. Venda nova nasce
 * no PDV — por isso nao ha mais formulario de pedido avulso.
 */
interface Order {
  id: string;
  customer_name: string | null;
  total: number;
  status: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  paid: 'pago',
  pending: 'pendente',
  pending_pix: 'aguardando_pix',
  failed: 'falhou',
  cancelled: 'cancelado',
};

const statusOptions = [
  { value: 'paid', label: 'Pago' },
  { value: 'pending_pix', label: 'Aguardando PIX' },
  { value: 'pending', label: 'Pendente' },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const Pedidos: React.FC = () => {
  const [activeTab, setActiveTab] = useState('lista');
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const result = await companyService.listOrders({ page, pageSize, search: search.trim() || undefined, status });
      setData(
        (result?.data || []).map((item) => ({
          id: item.id,
          customer_name: item.customerName,
          total: Number(item.total || 0),
          status: item.status,
          created_at: item.createdAt,
        }))
      );
      setTotalCount(Number(result?.total || 0));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar vendas');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const columns: Column<Order>[] = [
    {
      key: 'id',
      label: 'Venda',
      render: (item) => (
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-xs">#{item.id.slice(0, 8)}</span>
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
      render: (item) => <span className="font-medium">{formatCurrency(item.total)}</span>,
    },
    {
      key: 'status',
      label: 'Pagamento',
      render: (item) => <StatusBadge status={STATUS_LABEL[item.status] || item.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        description="Tudo o que foi vendido no PDV, nas cobranças e nas mensalidades. Para vender, use o PDV."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="lista">Histórico de vendas</TabsTrigger>
          <TabsTrigger value="relatorio">Vendas por cliente</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-6">
          <SearchFilters
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Buscar por cliente..."
            statusOptions={statusOptions}
            statusValue={status}
            onStatusChange={(value) => {
              setStatus(value === 'all' ? undefined : value);
              setPage(1);
            }}
            showClear={!!search || !!status}
            onClear={() => {
              setSearch('');
              setStatus(undefined);
              setPage(1);
            }}
          />

          <DataTable
            columns={columns}
            data={data}
            loading={loading}
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            emptyMessage="Nenhuma venda encontrada"
          />
        </TabsContent>

        <TabsContent value="relatorio" className="space-y-6">
          <SalesByCustomerReport activeTab={activeTab} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Pedidos;
