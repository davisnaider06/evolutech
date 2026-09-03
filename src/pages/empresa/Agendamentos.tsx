import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, Column } from '@/components/crud/DataTable';
import { PageHeader } from '@/components/crud/PageHeader';
import { SearchFilters } from '@/components/crud/SearchFilters';
import { FormDialog } from '@/components/crud/FormDialog';
import { StatusBadge } from '@/components/crud/StatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
// Toda hora de agendamento passa por aqui: a tela mostra a hora da
// barbearia, nao a do aparelho de quem esta olhando.
import {
  formatarData,
  formatarHora,
  paraCampoDataHora,
  doCampoDataHora,
} from '@/lib/horario';
import { Calendar, Clock, Copy, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { appointmentsService } from '@/services/appointments';
import { useAuth } from '@/contexts/AuthContext';
import { companyService } from '@/services/company';
import { AgendaBoard } from '@/components/agenda/AgendaBoard';

interface Appointment {
  id: string;
  company_id: string;
  service_id?: string | null;
  professional_id?: string | null;
  customer_id?: string | null;
  customer_phone?: string | null;
  customer_name: string | null;
  service_name: string;
  price?: number | null;
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

interface CustomerOption {
  id: string;
  name: string;
  phone?: string | null;
}

const statusOptions = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'concluido', label: 'Concluido' },
  { value: 'no_show', label: 'No-show' },
];

const Agendamentos: React.FC = () => {
  const { user, company } = useAuth();
  const navigate = useNavigate();
  const bookingSlug = user?.tenantSlug || company?.slug;
  const [isFormOpen, setIsFormOpen] = useState(false);
  // 'board' = grade por barbeiro (padrao da operacao); 'list' = tabela com busca.
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [boardRefresh, setBoardRefresh] = useState(0);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Appointment[]>([]);
  const [services, setServices] = useState<AppointmentServiceItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    // Cliente por id, nao por nome: dois clientes podem se chamar igual, e
    // era assim que o agendamento de um caia na ficha do outro.
    customer_id: '',
    customer_name: '',
    // Vazio = cobra o preco de tabela do servico. So vira numero quando o
    // barbeiro combina outro valor.
    price: '',
    // O servico tambem por id: e dele que sai a duracao, e duracao errada
    // e horario livre de mentira na agenda.
    service_id: '',
    service_name: '',
    // O nome sozinho nao bastava: a grade monta as colunas por professional_id,
    // entao agendamento salvo so com o nome nascia sem dono e sumia da agenda.
    professional_id: '',
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
    }
  }, []);

  const fetchProfessionals = useCallback(async () => {
    if (!bookingSlug) return;
    try {
      const options = await appointmentsService.getPublicBookingOptions(bookingSlug);
      const list = Array.isArray(options?.professionals) ? options.professionals : [];
      setProfessionals(list);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar profissionais');
    }
  }, [bookingSlug]);

  const fetchCustomers = useCallback(async () => {
    try {
      const result = await companyService.list('customers', {
        page: 1,
        pageSize: 200,
        is_active: 'true',
        orderBy: 'name',
      });
      const rows = Array.isArray(result?.data) ? result.data : [];
      setCustomers(
        rows.map((item: any) => ({
          id: item.id,
          name: item.name,
          phone: item.phone || null,
        }))
      );
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar clientes');
    }
  }, []);

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
    fetchCustomers();
  }, [fetchCustomers]);

  const columns: Column<Appointment>[] = [
    {
      key: 'scheduled_at',
      label: 'Data/Hora',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <div>{formatarData(item.scheduled_at)}</div>
            <div className="text-sm text-muted-foreground">
              {formatarHora(item.scheduled_at)}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'customer_name',
      label: 'Cliente',
      render: (item) =>
        item.customer_name ? (
          <div>
            <div>{item.customer_name}</div>
            {/* Dois clientes de mesmo nome so se distinguem pelo telefone. */}
            {item.customer_phone ? (
              <div className="text-xs text-muted-foreground">{item.customer_phone}</div>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">Sem cadastro</span>
        ),
    },
    { key: 'service_name', label: 'Servico' },
    {
      key: 'price',
      label: 'Valor',
      render: (item) =>
        item.price === null || item.price === undefined
          ? <span className="text-muted-foreground">-</span>
          : item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    },
    { key: 'professional_name', label: 'Profissional' },
    {
      key: 'scheduled_time',
      label: 'Horario',
      render: (item) => (
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {formatarHora(item.scheduled_at)}
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
    // Proxima hora cheia, na barbearia. toISOString() aqui era UTC: o
    // formulario abria com tres horas a mais do que o relogio da loja.
    const daquiUmaHora = paraCampoDataHora(new Date(Date.now() + 60 * 60 * 1000));
    // "2026-09-02T15:37" -> "2026-09-02T15:00"
    const proximaHoraCheia = `${daquiUmaHora.slice(0, 13)}:00`;
    setEditingAppointment(null);
    setFormData({
      customer_id: '',
      customer_name: '',
      price: '',
      service_id: '',
      service_name: '',
      professional_id: '',
      professional_name: '',
      scheduled_at: proximaHoraCheia,
      status: 'pendente',
    });
    setIsFormOpen(true);
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setFormData({
      customer_id: appointment.customer_id || '',
      customer_name: appointment.customer_name || '',
      price: appointment.price === null || appointment.price === undefined ? '' : String(appointment.price),
      service_id: appointment.service_id || '',
      service_name: appointment.service_name || '',
      professional_id: appointment.professional_id || '',
      professional_name: appointment.professional_name || '',
      // A string do banco vem em UTC. Cortar os 16 primeiros caracteres
      // jogava a hora de Londres dentro do campo.
      scheduled_at: paraCampoDataHora(appointment.scheduled_at),
      status: appointment.status || 'pendente',
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (appointment: Appointment) => {
    try {
      await appointmentsService.removeInternal(appointment.id);
      toast.success('Agendamento removido');
      fetchAppointments();
      setBoardRefresh((prev) => prev + 1);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir agendamento');
    }
  };

  const handleSubmit = async () => {
    // Cliente saiu da lista de obrigatorios: quem agenda pela agenda quase
    // sempre esta com o cliente na frente e nao quer cadastrar ninguem.
    if (!formData.service_id || !formData.professional_id || !formData.scheduled_at) {
      toast.error('Preencha servico, profissional e data/hora');
      return;
    }

    const precoDigitado = formData.price.trim();
    if (precoDigitado && !(Number(precoDigitado) >= 0)) {
      toast.error('Informe um valor valido');
      return;
    }

    const payload = {
      ...formData,
      customer_name: formData.customer_name.trim() || null,
      // Vazio vira null de proposito: null cobra o preco do servico, 0 seria
      // cortesia.
      price: precoDigitado ? Number(precoDigitado) : null,
      // Sai daqui como instante com fuso. O campo datetime-local nao tem
      // fuso nenhum, e era essa string solta que chegava no banco.
      scheduled_at: doCampoDataHora(formData.scheduled_at),
    };

    if (!payload.scheduled_at) {
      toast.error('Data e hora invalidas');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAppointment) {
        await appointmentsService.updateInternal(editingAppointment.id, payload);
        toast.success('Agendamento atualizado');
      } else {
        await appointmentsService.createInternal(payload);
        toast.success('Agendamento criado');
      }
      setIsFormOpen(false);
      fetchAppointments();
      setBoardRefresh((prev) => prev + 1);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar agendamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const precoDoServicoSelecionado = (() => {
    const escolhido = services.find((service) => service.id === formData.service_id);
    return escolhido ? escolhido.price.toFixed(2) : '0.00';
  })();

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

      {/* Grade x lista: a grade e a visao do dia a dia da barbearia,
          a lista serve para busca e edicao em massa. */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'board' ? 'default' : 'outline'}
          onClick={() => setViewMode('board')}
        >
          Agenda do dia
        </Button>
        <Button
          variant={viewMode === 'list' ? 'default' : 'outline'}
          onClick={() => setViewMode('list')}
        >
          Lista
        </Button>
      </div>

      {viewMode === 'board' && (
        <AgendaBoard
          refreshToken={boardRefresh}
          onSelectAppointment={(appointment) => {
            // A grade ja traz tudo o que o formulario precisa.
            setEditingAppointment({ id: appointment.id } as Appointment);
            setFormData({
              customer_id: appointment.customer_id || '',
              customer_name: appointment.customer_name || '',
              price:
                appointment.price === null || appointment.price === undefined
                  ? ''
                  : String(appointment.price),
              service_id: appointment.service_id || '',
              service_name: appointment.service_name || '',
              professional_id: appointment.professional_id || '',
              professional_name: appointment.professional_name || '',
              scheduled_at: paraCampoDataHora(appointment.scheduled_at),
              status: appointment.status || 'pendente',
            });
            setIsFormOpen(true);
          }}
          onCreateAppointment={(slot) => {
            // Veio de um toque num horario vazio: barbeiro, data e hora ja
            // resolvidos. Falta so o servico — cliente e valor sao opcionais.
            setEditingAppointment(null);
            setFormData({
              customer_id: '',
              customer_name: '',
              price: '',
              service_id: '',
              service_name: '',
              professional_id: slot.professional_id,
              professional_name: slot.professional_name,
              scheduled_at: slot.scheduled_at,
              status: 'pendente',
            });
            setIsFormOpen(true);
          }}
        />
      )}

      {/* Servicos sai daqui e vira tela propria: no celular esta pagina
          empilhava agenda e cadastro de servico, e nada era encontravel. */}
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => navigate('/empresa/servicos')}
          className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted"
        >
          <Scissors className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">Servicos</p>
            <p className="text-sm text-muted-foreground">
              Nome, duracao e preco do que o cliente agenda
            </p>
          </div>
        </button>
      </div>

      <div className="rounded-lg border p-4 bg-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground break-all">
          Link publico: <strong>{publicLink || 'indisponivel'}</strong>
        </div>
        <Button type="button" variant="outline" onClick={copyPublicLink} className="gap-2">
          <Copy className="h-4 w-4" />
          Copiar link
        </Button>
      </div>

      {viewMode === 'list' && (
      <>
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
      </>
      )}

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
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="customer_name">Cliente</Label>
              {formData.customer_id || formData.customer_name ? (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, customer_id: '', customer_name: '' })}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Sem cadastro
                </button>
              ) : null}
            </div>
            <SearchableSelect
              value={formData.customer_id}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  customer_id: value,
                  // O nome acompanha o cadastro escolhido; quem manda e o id.
                  customer_name: customers.find((item) => item.id === value)?.name || '',
                })
              }
              options={customers.map((customer) => ({
                value: customer.id,
                label: customer.phone ? `${customer.name} - ${customer.phone}` : customer.name,
              }))}
              placeholder="Sem cadastro"
              searchPlaceholder="Buscar por nome ou telefone..."
              emptyMessage="Nenhum cliente encontrado."
            />
            {/* Agenda antiga tem agendamento com nome escrito e nenhum cadastro
                atras. O nome continua valendo; so nao da para saber de quem e. */}
            {!formData.customer_id && formData.customer_name ? (
              <p className="text-xs text-amber-600">
                Anotado como "{formData.customer_name}", sem cadastro vinculado.
                Escolha o cliente na lista para ligar ao cadastro.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Opcional. Sem cliente o agendamento entra como "Sem cadastro". Clientes
              de mesmo nome aparecem com o telefone ao lado.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="service_name">Servico *</Label>
            <SearchableSelect
              value={formData.service_id}
              onValueChange={(value) => {
                // O servico so sugere o preco de tabela; o campo continua
                // livre para o desconto combinado no WhatsApp. A duracao,
                // essa sim, vem do id — e ela que reserva o tempo na agenda.
                const escolhido = services.find((service) => service.id === value);
                setFormData({
                  ...formData,
                  service_id: value,
                  service_name: escolhido?.name || '',
                  price: escolhido ? String(escolhido.price) : formData.price,
                });
              }}
              options={services.map((service) => ({
                value: service.id,
                label: `${service.name} - ${service.durationMinutes} min`,
              }))}
              placeholder="Selecionar serviço"
              searchPlaceholder="Buscar serviço..."
              emptyMessage="Nenhum serviço encontrado."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="price">Valor</Label>
              {formData.price ? (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, price: '' })}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Usar preco do servico
                </button>
              ) : null}
            </div>
            <Input
              id="price"
              type="number"
              min={0}
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder={precoDoServicoSelecionado}
            />
            <p className="text-xs text-muted-foreground">
              Vem do servico e pode ser editado — desconto combinado, cortesia, valor fechado.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="professional_name">Profissional *</Label>
            <SearchableSelect
              value={formData.professional_id}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  professional_id: value,
                  professional_name: professionals.find((item) => item.id === value)?.name || '',
                })
              }
              options={professionals.map((professional) => ({
                value: professional.id,
                label: professional.name,
              }))}
              placeholder="Selecionar profissional"
              searchPlaceholder="Buscar profissional..."
              emptyMessage="Nenhum profissional encontrado."
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
