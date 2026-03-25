import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DataTable, Column } from './DataTable';
import { PageHeader } from './PageHeader';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { companyService } from '@/services/company';
import { subDays } from 'date-fns';
import { DollarSign, ShoppingCart, Users } from 'lucide-react';

interface SaleItem {
  id: string;
  order_id: string;
  customer_name: string;
  item_type: 'product' | 'service';
  item_name: string;
  quantity: number;
  amount: number;
  sale_date: string;
  order_status: string;
}

interface CustomerSummary {
  customer_name: string;
  total_sales: number;
  total_items: number;
  total_amount: number;
}

interface SalesByCustomerResponse {
  period: {
    date_from: string;
    date_to: string;
  };
  filters: {
    customerName: string | null;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    totalSales: number;
    totalAmount: number;
    totalCustomers: number;
    averagePerCustomer: number;
  };
  data: SaleItem[];
  customer_summary: CustomerSummary[];
}

interface Props {
  activeTab?: string;
}

const SalesByCustomerReport: React.FC<Props> = ({ activeTab = 'sales' }) => {
  const [dateFrom, setDateFrom] = useState(subDays(new Date(), 30).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [data, setData] = useState<SalesByCustomerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await companyService.getSalesByCustomer({
        dateFrom,
        dateTo,
        customerName: customerName || undefined,
        page,
        pageSize,
      });
      // Map data to add id field from order_id
      const mappedData = {
        ...response,
        data: (response.data || []).map((item: any, idx: number) => ({
          ...item,
          id: `${item.order_id}-${idx}`,
        })),
      };
      setData(mappedData as SalesByCustomerResponse);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar relatório de vendas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo, page, pageSize]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleExportExcel = () => {
    if (!data || data.data.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    // Prepare data for export
    const salesData = data.data.map(item => ({
      'Data Venda': format(new Date(item.sale_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      'Cliente': item.customer_name,
      'Tipo': item.item_type === 'service' ? 'Serviço' : 'Produto',
      'Item': item.item_name,
      'Quantidade': item.quantity,
      'Valor': `R$ ${item.amount.toFixed(2)}`,
      'Status': item.order_status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(salesData);
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 25 },
      { wch: 12 },
      { wch: 30 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendas por Cliente');

    // Add summary sheet
    const summaryData = data.customer_summary.map(item => ({
      'Cliente': item.customer_name,
      'Total Vendas': item.total_sales,
      'Total Itens': item.total_items,
      'Valor Total': `R$ ${item.total_amount.toFixed(2)}`,
    }));

    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    summaryWorksheet['!cols'] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Resumo por Cliente');

    XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    XLSX.writeFile(workbook, `vendas-por-cliente-${dateFrom}-${dateTo}.xlsx`);
    toast.success('Relatório exportado com sucesso');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const columns: Column<SaleItem>[] = [
    {
      key: 'sale_date',
      label: 'Data',
      render: (item) => format(new Date(item.sale_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    },
    {
      key: 'customer_name',
      label: 'Cliente',
      render: (item) => <span className="font-medium">{item.customer_name}</span>,
    },
    {
      key: 'item_type',
      label: 'Tipo',
      render: (item) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          item.item_type === 'service'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {item.item_type === 'service' ? 'Serviço' : 'Produto'}
        </span>
      ),
    },
    {
      key: 'item_name',
      label: 'Item',
      render: (item) => item.item_name,
    },
    {
      key: 'quantity',
      label: 'Qtd',
      render: (item) => item.quantity,
    },
    {
      key: 'amount',
      label: 'Valor',
      render: (item) => (
        <span className="font-semibold">{formatCurrency(item.amount)}</span>
      ),
    },
    {
      key: 'order_status',
      label: 'Status',
      render: (item) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          item.order_status === 'paid'
            ? 'bg-green-100 text-green-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {item.order_status === 'paid' ? 'Pago' : 'Pendente'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas por Cliente"
        description="Visualize todas as vendas agrupadas por cliente"
        buttonLabel="Exportar Excel"
        onButtonClick={handleExportExcel}
      />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dateFrom">Data Inicial</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Data Final</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="customerName">Cliente</Label>
              <Input
                id="customerName"
                placeholder="Digite o nome do cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleSearch} className="w-full md:w-auto">
            Buscar
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.totalSales}</div>
              <p className="text-xs text-muted-foreground">itens vendidos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.summary.totalAmount)}</div>
              <p className="text-xs text-muted-foreground">período selecionado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">clientes únicos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média por Cliente</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.summary.averagePerCustomer)}</div>
              <p className="text-xs text-muted-foreground">por cliente</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes das Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.data || []}
            loading={loading}
            totalCount={data?.pagination.totalCount || 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newPageSize) => {
              setPageSize(newPageSize);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* Customer Summary Table */}
      {data && data.customer_summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo por Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Cliente</th>
                    <th className="text-right py-3 px-4 font-medium">Vendas</th>
                    <th className="text-right py-3 px-4 font-medium">Itens</th>
                    <th className="text-right py-3 px-4 font-medium">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customer_summary.map((customer, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{customer.customer_name}</td>
                      <td className="text-right py-3 px-4">{customer.total_sales}</td>
                      <td className="text-right py-3 px-4">{customer.total_items}</td>
                      <td className="text-right py-3 px-4 font-semibold">
                        {formatCurrency(customer.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SalesByCustomerReport;
