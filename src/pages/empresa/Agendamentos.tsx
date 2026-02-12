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
import { Calendar, Clock, User } from 'lucide-react';

interface Appointment {
  id: string;
  company_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  service_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  price: number | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const defaultAppointment: Partial<Appointment> = {
  customer_name: '',
  customer_phone: '',
  service_name: '',
  scheduled_at: '',
  duration_minutes: 60,
  status: 'pendente',
  notes: '',
  price: 0,
};

const statusOptions = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'concluido', label: 'Concluído' },
];

const Agendamentos: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState<Partial<Appointment>>(defaultAppointment);
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
  } = useCompanyData<Appointment>('appointments', ['customer_name', 'service_name'], 'scheduled_at');

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

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
    {
      key: 'customer_name',
      label: 'Cliente',
      render: (item) => (
        <div>
          <div className="font-medium">{item.customer_name || 'Não informado'}</div>
          {item.customer_phone && (
            <div className="text-sm text-muted-foreground">{item.customer_phone}</div>
          )}
        </div>
      ),
    },
    { key: 'service_name', label: 'Serviço' },
    {
      key: 'duration_minutes',
      label: 'Duração',
      render: (item) => (
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {item.duration_minutes} min
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Valor',
      render: (item) => formatCurrency(item.price),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  const handleNew = () => {
    setEditingAppointment(null);
    const now = new Date();
    now.setMinutes(0);
    now.setHours(now.getHours() + 1);
    setFormData({
      ...defaultAppointment,
      scheduled_at: now.toISOString().slice(0, 16),
    });
    setIsFormOpen(true);
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setFormData({
      ...appointment,
      scheduled_at: appointment.scheduled_at.slice(0, 16),
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.service_name?.trim() || !formData.scheduled_at) return;

    setIsSubmitting(true);
    try {
      if (editingAppointment) {
        await update(editingAppointment.id, formData);
      } else {
        await create(formData);
      }
      setIsFormOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (appointment: Appointment) => {
    await remove(appointment.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agendamentos"
        description="Gerencie os agendamentos da sua empresa"
        buttonLabel="Novo Agendamento"
        onButtonClick={handleNew}
      />

      <SearchFilters
        searchValue={filters.search || ''}
        onSearchChange={(value) => setFilters({ ...filters, search: value })}
        searchPlaceholder="Buscar por cliente ou serviço..."
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
            <Label htmlFor="customer_name">Nome do Cliente</Label>
            <Input
              id="customer_name"
              value={formData.customer_name || ''}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              placeholder="Nome do cliente"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_phone">Telefone</Label>
            <Input
              id="customer_phone"
              value={formData.customer_phone || ''}
              onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="service_name">Serviço *</Label>
            <Input
              id="service_name"
              value={formData.service_name || ''}
              onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
              placeholder="Nome do serviço"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduled_at">Data e Hora *</Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              value={formData.scheduled_at || ''}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration_minutes">Duração (minutos)</Label>
            <Input
              id="duration_minutes"
              type="number"
              min="15"
              step="15"
              value={formData.duration_minutes || 60}
              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Valor</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price || 0}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
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

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Informações adicionais sobre o agendamento"
              rows={3}
            />
          </div>
        </div>
      </FormDialog>
    </div>
  );
};

export default Agendamentos;
