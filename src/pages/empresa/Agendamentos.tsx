import React, { useCallback, useEffect, useState } from 'react';
import { DataTable, Column } from '@/components/crud/DataTable';
import { PageHeader } from '@/components/crud/PageHeader';
import { SearchFilters } from '@/components/crud/SearchFilters';
import { FormDialog } from '@/components/crud/FormDialog';
import { StatusBadge } from '@/components/crud/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { appointmentsService } from '@/services/appointments';
import { useAuth } from '@/contexts/AuthContext';

interface Appointment {
  id: string;
  company_id: string;
  customer_name: string;
  service_name: string;
  scheduled_at: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const statusOptions = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'concluido', label: 'Concluido' },
];

const Agendamentos: React.FC = () => {
  const { user } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    customer_name: '',
    service_name: '',
    scheduled_at: '',
    status: 'pendente',
  });

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await appointmentsService.listInternal({
        page,
        pageSize,
        search: search || undefined,
        status,
      });
      setData(result.data || []);
      setTotal(result.total || 0);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const columns: Column<Appointment>[] = [
    {
      key: 'scheduled_at',
      label: 'Data/Hora',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <div>{format(new Date(item.scheduled_at), 'dd/MM/yyyy', { locale: ptBR })}</div>
            <div className="text-sm text-muted-foreground">
              {format(new Date(item.scheduled_at), 'HH:mm', { locale: ptBR })}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'customer_name', label: 'Cliente' },
    { key: 'service_name', label: 'Servico' },
    {
      key: 'scheduled_time',
      label: 'Horario',
      render: (item) => (
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {format(new Date(item.scheduled_at), 'HH:mm', { locale: ptBR })}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  const handleNew = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    setEditingAppointment(null);
    setFormData({
      customer_name: '',
      service_name: '',
      scheduled_at: now.toISOString().slice(0, 16),
      status: 'pendente',
    });
    setIsFormOpen(true);
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setFormData({
      customer_name: appointment.customer_name || '',
      service_name: appointment.service_name || '',
      scheduled_at: appointment.scheduled_at.slice(0, 16),
      status: appointment.status || 'pendente',
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (appointment: Appointment) => {
    try {
      await appointmentsService.removeInternal(appointment.id);
      toast.success('Agendamento removido');
      fetchAppointments();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir agendamento');
    }
  };

  const handleSubmit = async () => {
    if (!formData.customer_name.trim() || !formData.service_name.trim() || !formData.scheduled_at) {
      toast.error('Preencha cliente, servico e data/hora');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAppointment) {
        await appointmentsService.updateInternal(editingAppointment.id, formData);
        toast.success('Agendamento atualizado');
      } else {
        await appointmentsService.createInternal(formData);
        toast.success('Agendamento criado');
      }
      setIsFormOpen(false);
      fetchAppointments();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar agendamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const publicLink = user?.tenantSlug
    ? `${window.location.origin}/agendar/${user.tenantSlug}`
    : '';

  const copyPublicLink = async () => {
    if (!publicLink) {
      toast.error('Nao foi possivel gerar link de agendamento');
      return;
    }
    await navigator.clipboard.writeText(publicLink);
    toast.success('Link de agendamento copiado');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agendamentos"
        description="Gerencie os agendamentos e compartilhe o link publico com seus clientes"
        buttonLabel="Novo Agendamento"
        onButtonClick={handleNew}
      />

      <div className="rounded-lg border p-4 bg-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground break-all">
          Link publico: <strong>{publicLink || 'indisponivel'}</strong>
        </div>
        <Button type="button" variant="outline" onClick={copyPublicLink} className="gap-2">
          <Copy className="h-4 w-4" />
          Copiar link
        </Button>
      </div>

      <SearchFilters
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Buscar por cliente ou servico..."
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
        totalCount={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="Nenhum agendamento encontrado"
      />

      <FormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
        description="Preencha os dados do agendamento"
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        size="lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer_name">Cliente *</Label>
            <Input
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              placeholder="Nome do cliente"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service_name">Servico *</Label>
            <Input
              id="service_name"
              value={formData.service_name}
              onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
              placeholder="Ex: Corte + Barba"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduled_at">Data e hora *</Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Input
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              placeholder="pendente / confirmado / concluido / cancelado"
            />
          </div>
        </div>
      </FormDialog>
    </div>
  );
};

export default Agendamentos;
