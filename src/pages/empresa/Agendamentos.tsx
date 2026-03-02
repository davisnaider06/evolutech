import React, { useCallback, useEffect, useState } from 'react';
import { DataTable, Column } from '@/components/crud/DataTable';
import { PageHeader } from '@/components/crud/PageHeader';
import { SearchFilters } from '@/components/crud/SearchFilters';
import { FormDialog } from '@/components/crud/FormDialog';
import { StatusBadge } from '@/components/crud/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { appointmentsService } from '@/services/appointments';
import { useAuth } from '@/contexts/AuthContext';
import { companyService } from '@/services/company';

interface Appointment {
  id: string;
  company_id: string;
  service_id?: string | null;
  professional_id?: string | null;
  customer_name: string;
  service_name: string;
  professional_name?: string;
  scheduled_at: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AppointmentServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

interface ProfessionalOption {
  id: string;
  name: string;
}

interface AvailabilityRow {
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terca' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sabado' },
];

const statusOptions = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'concluido', label: 'Concluido' },
  { value: 'no_show', label: 'No-show' },
];

const Agendamentos: React.FC = () => {
  const { user, company } = useAuth();
  const bookingSlug = user?.tenantSlug || company?.slug;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Appointment[]>([]);
  const [services, setServices] = useState<AppointmentServiceItem[]>([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: '', durationMinutes: 30, price: 0 });
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [availability, setAvailability] = useState<AvailabilityRow[]>(
    WEEKDAYS.map((day) => ({
      weekday: day.value,
      start_time: '08:00',
      end_time: '17:00',
      is_active: day.value >= 1 && day.value <= 5,
    }))
  );
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    customer_name: '',
    service_name: '',
    professional_name: '',
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

  const fetchServices = useCallback(async () => {
    setServiceLoading(true);
    try {
      const result = await companyService.list('appointment_services', {
        page: 1,
        pageSize: 200,
      });
      const rows = Array.isArray(result?.data) ? result.data : [];
      setServices(
        rows.map((item: any) => ({
          id: item.id,
          name: item.name,
          durationMinutes: Number(item.durationMinutes || 30),
          price: Number(item.price || 0),
          isActive: item.isActive !== false,
        }))
      );
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar servicos');
    } finally {
      setServiceLoading(false);
    }
  }, []);

  const fetchProfessionals = useCallback(async () => {
    if (!bookingSlug) return;
    try {
      const options = await appointmentsService.getPublicBookingOptions(bookingSlug);
      const list = Array.isArray(options?.professionals) ? options.professionals : [];
      setProfessionals(list);
      if (!selectedProfessionalId && list.length > 0) {
        const fallback = user?.role === 'FUNCIONARIO_EMPRESA'
          ? list.find((item: any) => item.id === user.id)?.id || list[0].id
          : list[0].id;
        setSelectedProfessionalId(fallback);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar profissionais');
    }
  }, [bookingSlug, selectedProfessionalId, user?.id, user?.role]);

  const fetchAvailability = useCallback(async () => {
    if (!selectedProfessionalId) return;
    try {
      const rows = await companyService.listAppointmentAvailability(selectedProfessionalId);
      const map = new Map<number, AvailabilityRow>();
      (Array.isArray(rows) ? rows : []).forEach((row: any) => {
        map.set(Number(row.weekday), {
          weekday: Number(row.weekday),
          start_time: row.start_time,
          end_time: row.end_time,
          is_active: row.is_active !== false,
        });
      });
      setAvailability(
        WEEKDAYS.map((day) =>
          map.get(day.value) || {
            weekday: day.value,
            start_time: '08:00',
            end_time: '17:00',
            is_active: false,
          }
        )
      );
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar disponibilidade');
    }
  }, [selectedProfessionalId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    fetchProfessionals();
  }, [fetchProfessionals]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const handleCreateService = async () => {
    const name = serviceForm.name.trim();
    if (!name) {
      toast.error('Informe o nome do servico');
      return;
    }

    try {
      await companyService.create('appointment_services', {
        name,
        durationMinutes: Math.max(5, Number(serviceForm.durationMinutes || 30)),
        price: Math.max(0, Number(serviceForm.price || 0)),
        isActive: true,
      });
      setServiceForm({ name: '', durationMinutes: 30, price: 0 });
      toast.success('Servico cadastrado');
      fetchServices();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cadastrar servico');
    }
  };

  const handleSaveAvailability = async () => {
    if (!selectedProfessionalId) {
      toast.error('Selecione um profissional');
      return;
    }
    setSavingAvailability(true);
    try {
      await companyService.saveAppointmentAvailability(selectedProfessionalId, availability);
      toast.success('Disponibilidade salva');
      fetchAvailability();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar disponibilidade');
    } finally {
      setSavingAvailability(false);
    }
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
    { key: 'customer_name', label: 'Cliente' },
    { key: 'service_name', label: 'Servico' },
    { key: 'professional_name', label: 'Profissional' },
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
      professional_name: '',
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
      professional_name: appointment.professional_name || '',
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
    if (!formData.customer_name.trim() || !formData.service_name.trim() || !formData.professional_name.trim() || !formData.scheduled_at) {
      toast.error('Preencha cliente, servico, profissional e data/hora');
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

  const publicLink = bookingSlug
    ? `${window.location.origin}/agendar/${bookingSlug}`
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

      <Card>
        <CardHeader>
          <CardTitle>Servicos para Agendamento Publico</CardTitle>
          <CardDescription>
            Cadastre os servicos que o cliente podera selecionar no link publico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.role === 'DONO_EMPRESA' ? (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Nome do servico</Label>
                <p className="text-xs text-muted-foreground">Como o cliente vera no link publico.</p>
                <Input
                  placeholder="Ex: Corte masculino"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Duracao (min)</Label>
                <p className="text-xs text-muted-foreground">Tempo usado para calcular horarios disponiveis.</p>
                <Input
                  type="number"
                  min={5}
                  placeholder="30"
                  value={serviceForm.durationMinutes}
                  onChange={(e) =>
                    setServiceForm((prev) => ({ ...prev, durationMinutes: Number(e.target.value || 30) }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Preco</Label>
                <p className="text-xs text-muted-foreground">Valor exibido para referencia do cliente.</p>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={serviceForm.price}
                  onChange={(e) =>
                    setServiceForm((prev) => ({ ...prev, price: Number(e.target.value || 0) }))
                  }
                />
              </div>
              <Button onClick={handleCreateService}>Cadastrar Servico</Button>
            </div>
          ) : null}

          {serviceLoading ? (
            <p className="text-sm text-muted-foreground">Carregando servicos...</p>
          ) : services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum servico cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {services.map((service) => (
                <div key={service.id} className="flex items-center justify-between rounded border px-3 py-2">
                  <span className="text-sm">
                    {service.name} - {service.durationMinutes}min - R$ {service.price.toFixed(2)}
                  </span>
                  <StatusBadge status={service.isActive ? 'active' : 'inactive'} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Disponibilidade dos Profissionais</CardTitle>
          <CardDescription>
            Defina os horarios de trabalho. O cliente so vera horarios livres dentro dessas janelas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-2">
              <Label>Profissional</Label>
              <select
                value={selectedProfessionalId}
                onChange={(e) => setSelectedProfessionalId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={user?.role === 'FUNCIONARIO_EMPRESA'}
              >
                <option value="">Selecione</option>
                {professionals.map((prof) => (
                  <option key={prof.id} value={prof.id}>
                    {prof.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleSaveAvailability} disabled={savingAvailability || !selectedProfessionalId}>
              {savingAvailability ? 'Salvando...' : 'Salvar Disponibilidade'}
            </Button>
          </div>

          <div className="space-y-2">
            {availability.map((row) => (
              <div key={row.weekday} className="grid gap-2 rounded border p-3 md:grid-cols-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={row.is_active}
                    onChange={(e) =>
                      setAvailability((prev) =>
                        prev.map((item) =>
                          item.weekday === row.weekday ? { ...item, is_active: e.target.checked } : item
                        )
                      )
                    }
                  />
                  <span>{WEEKDAYS.find((day) => day.value === row.weekday)?.label}</span>
                </div>
                <Input
                  type="time"
                  value={row.start_time}
                  disabled={!row.is_active}
                  onChange={(e) =>
                    setAvailability((prev) =>
                      prev.map((item) =>
                        item.weekday === row.weekday ? { ...item, start_time: e.target.value } : item
                      )
                    )
                  }
                />
                <Input
                  type="time"
                  value={row.end_time}
                  disabled={!row.is_active}
                  onChange={(e) =>
                    setAvailability((prev) =>
                      prev.map((item) =>
                        item.weekday === row.weekday ? { ...item, end_time: e.target.value } : item
                      )
                    )
                  }
                />
                <div className="text-xs text-muted-foreground flex items-center">
                  {row.is_active ? 'Disponivel' : 'Folga'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
            <Label htmlFor="professional_name">Profissional *</Label>
            <Input
              id="professional_name"
              value={formData.professional_name}
              onChange={(e) => setFormData({ ...formData, professional_name: e.target.value })}
              placeholder="Ex: Dr. Rafael"
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
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FormDialog>
    </div>
  );
};

export default Agendamentos;
