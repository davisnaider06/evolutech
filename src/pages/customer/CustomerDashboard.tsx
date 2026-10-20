import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { customerPortalService, rotaLoginCliente } from '@/services/customer-portal';
import {
  CustomerAppointment,
  CustomerBookingOptionsResponse,
  CustomerDashboardResponse,
  CustomerPaymentGatewayResult,
  CustomerPlanCatalogItem,
  CustomerSubscription,
} from '@/types/customer-portal';
import { formatarData, formatarDataHora, hojeNaBarbearia } from '@/lib/horario';
import { AtivarNotificacoes } from '@/components/notificacoes/AtivarNotificacoes';
import EscolhaProfissional from '@/components/agenda/EscolhaProfissional';
import { lerAgendamentoPendente } from '@/lib/agendamento-pendente';
import AvaliarAtendimento from '@/components/avaliacao/AvaliarAtendimento';
import { Estrelas } from '@/components/avaliacao/Estrelas';

/**
 * Hora da barbearia, sempre.
 *
 * O cliente pode abrir o portal de qualquer lugar; o corte e no horario da
 * loja. Formatando pelo fuso do aparelho, o mesmo agendamento aparecia com
 * uma hora para o cliente e outra para o barbeiro.
 */
const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return formatarDataHora(value) || '-';
};

const formatCurrency = (value?: number | null) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// O cliente le "Confirmado", nao "confirmado" nem "no_show".
const STATUS_AGENDAMENTO: Record<string, { texto: string; classe: string }> = {
  pendente: { texto: 'Aguardando confirmação', classe: 'border-amber-500/40 text-amber-600' },
  confirmado: { texto: 'Confirmado', classe: 'border-emerald-500/40 text-emerald-600' },
  concluido: { texto: 'Concluído', classe: 'text-muted-foreground' },
  cancelado: { texto: 'Cancelado', classe: 'text-muted-foreground' },
  no_show: { texto: 'Não compareceu', classe: 'text-muted-foreground' },
};
const statusAgendamento = (status: string) =>
  STATUS_AGENDAMENTO[status] || { texto: status, classe: 'text-muted-foreground' };

const STATUS_ASSINATURA: Record<string, string> = {
  active: 'Ativa',
  pending: 'Aguardando pagamento',
  overdue: 'Vencida',
  expired: 'Encerrada',
  canceled: 'Cancelada',
  suspended: 'Suspensa',
};

const PERIODO: Record<string, string> = {
  monthly: 'por mês',
  quarterly: 'por trimestre',
  yearly: 'por ano',
};

const rotuloServico = (service: { name: string; duration_minutes?: number; price?: number }) => {
  const detalhes = [
    service.duration_minutes ? `${service.duration_minutes} min` : '',
    Number(service.price || 0) > 0 ? formatCurrency(service.price) : '',
  ].filter(Boolean);
  return detalhes.length ? `${service.name} — ${detalhes.join(' · ')}` : service.name;
};

const resumoPlano = (plan: { is_unlimited: boolean; included_services?: number | null }) =>
  plan.is_unlimited
    ? 'Serviços ilimitados no período'
    : plan.included_services
      ? `${plan.included_services} serviços no período`
      : '';

const CustomerDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<CustomerDashboardResponse | null>(null);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [plansCatalog, setPlansCatalog] = useState<CustomerPlanCatalogItem[]>([]);
  const [bookingOptions, setBookingOptions] = useState<CustomerBookingOptionsResponse | null>(null);
  const [appointmentForm, setAppointmentForm] = useState({
    service_id: '',
    professional_id: '',
    date: '',
    scheduled_at: '',
  });
  const [availableSlots, setAvailableSlots] = useState<Array<{ time: string; scheduled_at: string }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [subscribePlanId, setSubscribePlanId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credito' | 'debito'>('pix');
  const [subscriptionPaymentResult, setSubscriptionPaymentResult] =
    useState<CustomerPaymentGatewayResult | null>(null);
  const { customer, company, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [avaliando, setAvaliando] = useState<CustomerAppointment | null>(null);

  const loadData = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      customerPortalService.dashboard(),
      customerPortalService.appointments(),
      customerPortalService.subscriptions(),
      customerPortalService.bookingOptions(),
      customerPortalService.plans(),
    ]);
    const [dashboardData, appointmentsData, subscriptionsData, bookingData, plansData] = results;
    if (dashboardData.status === 'fulfilled') setDashboard(dashboardData.value);
    if (appointmentsData.status === 'fulfilled') setAppointments(appointmentsData.value);
    if (subscriptionsData.status === 'fulfilled') setSubscriptions(subscriptionsData.value);
    if (bookingData.status === 'fulfilled') setBookingOptions(bookingData.value);
    if (plansData.status === 'fulfilled') setPlansCatalog(plansData.value);

    const firstError = results.find((result) => result.status === 'rejected');
    if (firstError?.status === 'rejected') {
      toast.error(firstError.reason?.message || 'Alguns dados do portal não puderam ser carregados');
    }
    setLoading(false);
  };

  useEffect(() => {
    // Horario escolhido no link e ainda nao confirmado: o cliente confirma
    // na tela de resumo, nao aqui.
    if (company?.slug && lerAgendamentoPendente(company.slug)) {
      navigate(`/agendar/${company.slug}/confirmar`, { replace: true });
      return;
    }
    loadData();
  }, []);

  // O push "Como foi o seu atendimento?" abre o portal com ?avaliar=<id>.
  useEffect(() => {
    const id = searchParams.get('avaliar');
    if (!id || loading) return;
    const alvo = appointments.find((item) => item.id === id);
    if (alvo?.can_review) setAvaliando(alvo);
    searchParams.delete('avaliar');
    setSearchParams(searchParams, { replace: true });
  }, [loading, appointments]);

  useEffect(() => {
    const loadSlots = async () => {
      if (!appointmentForm.service_id || !appointmentForm.professional_id || !appointmentForm.date) {
        setAvailableSlots([]);
        setAppointmentForm((old) => ({ ...old, scheduled_at: '' }));
        return;
      }
      setLoadingSlots(true);
      try {
        const data = await customerPortalService.appointmentSlots({
          date: appointmentForm.date,
          service_id: appointmentForm.service_id,
          professional_id: appointmentForm.professional_id,
        });
        setAvailableSlots(Array.isArray(data.slots) ? data.slots : []);
        setAppointmentForm((old) => ({ ...old, scheduled_at: '' }));
      } catch (error: any) {
        setAvailableSlots([]);
        setAppointmentForm((old) => ({ ...old, scheduled_at: '' }));
        toast.error(error.message || 'Erro ao carregar horários disponíveis');
      } finally {
        setLoadingSlots(false);
      }
    };

    loadSlots();
  }, [appointmentForm.service_id, appointmentForm.professional_id, appointmentForm.date]);

  const canCancelStatus = useMemo(() => new Set(['pendente', 'confirmado']), []);

  const handleCreateAppointment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!appointmentForm.service_id || !appointmentForm.professional_id || !appointmentForm.date || !appointmentForm.scheduled_at) {
      toast.error('Escolha serviço, profissional, dia e horário');
      return;
    }
    setCreatingAppointment(true);
    try {
      await customerPortalService.createAppointment({
        service_id: appointmentForm.service_id,
        professional_id: appointmentForm.professional_id,
        scheduled_at: appointmentForm.scheduled_at,
      });
      toast.success('Horário marcado!');
      setAppointmentForm({ service_id: '', professional_id: '', date: '', scheduled_at: '' });
      setAvailableSlots([]);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível agendar');
    } finally {
      setCreatingAppointment(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!window.confirm('Cancelar este horário?')) return;
    setCancelingId(appointmentId);
    try {
      await customerPortalService.cancelAppointment(appointmentId);
      toast.success('Horário cancelado');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível cancelar');
    } finally {
      setCancelingId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate(rotaLoginCliente(), { replace: true });
  };

  const handleSubscribePlan = async () => {
    if (!subscribePlanId) return;
    setSubscriptionPaymentResult(null);
    setSubscribingPlanId(subscribePlanId);
    try {
      const result = await customerPortalService.subscribePlan(subscribePlanId, {
        payment_method: paymentMethod,
      });
      setSubscriptionPaymentResult(result.payment_gateway || null);
      toast.success('Assinatura criada. Finalize o pagamento para ativar.');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Falha ao assinar plano');
    } finally {
      setSubscribingPlanId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Proximos em ordem de data (o mais perto primeiro); o resto e historico.
  // A API devolve tudo do mais novo para o mais velho, e o horario de
  // amanha ficava escondido no meio da lista.
  const agora = Date.now();
  const proximos = appointments
    .filter((item) => canCancelStatus.has(item.status) && new Date(item.scheduled_at).getTime() >= agora)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const historico = appointments.filter((item) => !proximos.includes(item));
  const proximo = proximos[0];
  const planosAtivos = new Set(
    subscriptions.filter((item) => item.status === 'active' || item.status === 'pending').map((item) => item.plan?.id)
  );
  const agendaDisponivel = Boolean(bookingOptions?.services?.length && bookingOptions?.professionals?.length);

  // O mais recente primeiro: e o corte que o cliente ainda lembra.
  const paraAvaliar = appointments.find((item) => item.can_review);

  const linhaAgendamento = (item: CustomerAppointment) => {
    const status = statusAgendamento(item.status);
    return (
      <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
        <div className="min-w-0">
          <p className="font-medium">{item.service_name || 'Serviço'}</p>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(item.scheduled_at)} · {item.professional_name || 'Profissional'}
          </p>
          {item.review ? <Estrelas nota={item.review.rating} className="mt-1" /> : null}
        </div>
        {item.can_review ? (
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setAvaliando(item)}>
            <Star className="mr-1 h-3.5 w-3.5" />
            Avaliar
          </Button>
        ) : (
          <Badge variant="outline" className={`shrink-0 ${status.classe}`}>
            {status.texto}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-10 w-10 rounded-md object-contain border border-border bg-background p-1"
              />
            ) : null}
            <div>
              <h1 className="text-xl font-bold">{company?.name || 'Meus horários'}</h1>
              <p className="text-sm text-muted-foreground">Olá, {customer?.name?.split(' ')[0]}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sair
          </Button>
        </div>

        {/* O que o cliente abre o portal para saber: quando e o proximo
            horario. Antes o topo eram dois numeros (total e proximos). */}
        <Card className="border-primary/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Seu próximo horário</p>
            {proximo ? (
              <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-2xl font-bold">{formatDateTime(proximo.scheduled_at)}</p>
                  <p className="text-sm text-muted-foreground">
                    {proximo.service_name || 'Serviço'} com {proximo.professional_name || 'profissional'}
                  </p>
                  <Badge variant="outline" className={`mt-2 ${statusAgendamento(proximo.status).classe}`}>
                    {statusAgendamento(proximo.status).texto}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start text-muted-foreground sm:self-end"
                  disabled={cancelingId === proximo.id}
                  onClick={() => handleCancelAppointment(proximo.id)}
                >
                  {cancelingId === proximo.id ? 'Cancelando...' : 'Cancelar horário'}
                </Button>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Nenhum horário marcado. Agende abaixo.</p>
            )}
          </CardContent>
        </Card>

        {paraAvaliar ? (
          <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold">Como foi seu último atendimento?</p>
                <p className="text-sm text-muted-foreground">
                  {paraAvaliar.service_name || 'Serviço'} com {paraAvaliar.professional_name || 'o profissional'}.
                  Anônimo para o barbeiro.
                </p>
              </div>
              <Button size="sm" className="shrink-0" onClick={() => setAvaliando(paraAvaliar)}>
                Avaliar
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <AvaliarAtendimento
          atendimento={avaliando}
          onClose={() => setAvaliando(null)}
          onAvaliado={() => {
            setAvaliando(null);
            loadData();
          }}
        />

        <AtivarNotificacoes
          api={customerPortalService}
          textos={{
            ativo: 'Este aparelho recebe a confirmação e os lembretes dos seus horários.',
            convite: 'Receba a confirmação do agendamento e lembretes um dia, uma hora e 15 minutos antes.',
          }}
        />

        <Tabs defaultValue="appointments" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="appointments">Horários</TabsTrigger>
            <TabsTrigger value="subscriptions">Planos</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Marcar horário</CardTitle>
              </CardHeader>
              <CardContent>
                {!agendaDisponivel ? (
                  <p className="text-sm text-muted-foreground">
                    A agenda online ainda não está aberta. Fale com a barbearia para marcar.
                  </p>
                ) : (
                  // Mesma ordem do link publico: servico (com preco),
                  // profissional, dia e horario em botoes.
                  <form className="space-y-3" onSubmit={handleCreateAppointment}>
                    <select
                      aria-label="Serviço"
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      value={appointmentForm.service_id}
                      onChange={(event) =>
                        setAppointmentForm((old) => ({ ...old, service_id: event.target.value, scheduled_at: '' }))
                      }
                    >
                      <option value="">1. Escolha o serviço</option>
                      {(bookingOptions?.services || []).map((item) => (
                        <option key={item.id} value={item.id}>{rotuloServico(item)}</option>
                      ))}
                    </select>
                    <p className="text-sm font-medium">2. Escolha o profissional</p>
                    <EscolhaProfissional
                      profissionais={bookingOptions?.professionals || []}
                      valor={appointmentForm.professional_id}
                      onChange={(id) =>
                        setAppointmentForm((old) => ({ ...old, professional_id: id, scheduled_at: '' }))
                      }
                    />
                    <input
                      aria-label="Dia"
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      type="date"
                      min={hojeNaBarbearia()}
                      value={appointmentForm.date}
                      onChange={(event) =>
                        setAppointmentForm((old) => ({ ...old, date: event.target.value, scheduled_at: '' }))
                      }
                    />
                    {availableSlots.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Horários livres">
                        {availableSlots.map((slot) => {
                          const ativo = appointmentForm.scheduled_at === slot.scheduled_at;
                          return (
                            <button
                              key={slot.scheduled_at}
                              type="button"
                              role="radio"
                              aria-checked={ativo}
                              onClick={() => setAppointmentForm((old) => ({ ...old, scheduled_at: slot.scheduled_at }))}
                              className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                                ativo
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-input bg-background hover:border-primary'
                              }`}
                            >
                              {slot.time}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-md border border-dashed border-input px-3 py-3 text-sm text-muted-foreground">
                        {!appointmentForm.service_id || !appointmentForm.professional_id || !appointmentForm.date
                          ? 'Escolha serviço, profissional e dia para ver os horários.'
                          : loadingSlots
                            ? 'Carregando horários...'
                            : 'Nenhum horário livre nesse dia. Tente outra data ou outro profissional.'}
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="h-11 w-full"
                      disabled={creatingAppointment || !appointmentForm.scheduled_at}
                    >
                      {creatingAppointment ? 'Agendando...' : 'Confirmar horário'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

            {proximos.length > 1 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">Outros horários marcados</h2>
                {proximos.slice(1).map(linhaAgendamento)}
              </div>
            )}

            {historico.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">Histórico</h2>
                {historico.map(linhaAgendamento)}
              </div>
            )}
          </TabsContent>

          {/* Primeiro o que o cliente ja tem; depois o que pode contratar.
              Antes os planos a venda vinham sob "Minhas Assinaturas" e
              pareciam ser dele. */}
          <TabsContent value="subscriptions" className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Seu plano</h2>
              {subscriptions.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Você ainda não tem plano.
                </p>
              ) : (
                subscriptions.map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{item.plan?.name || 'Plano removido'}</p>
                      <Badge variant="outline">{STATUS_ASSINATURA[item.status] || item.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(item.amount)} {PERIODO[item.plan?.interval || ''] || ''}
                      {item.end_at ? ` · válido até ${formatarData(item.end_at)}` : ''}
                    </p>
                    {item.remaining_services != null && !item.plan?.is_unlimited && (
                      <p className="text-sm">Restam {item.remaining_services} serviços</p>
                    )}
                  </div>
                ))
              )}
            </div>

            {plansCatalog.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">Planos disponíveis</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {plansCatalog.map((plan) => (
                    <div key={plan.id} className="flex flex-col rounded-md border p-3">
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-lg font-bold">
                        {formatCurrency(plan.price)}{' '}
                        <span className="text-sm font-normal text-muted-foreground">{PERIODO[plan.interval] || ''}</span>
                      </p>
                      {resumoPlano(plan) && <p className="text-sm text-muted-foreground">{resumoPlano(plan)}</p>}
                      {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
                      {planosAtivos.has(plan.id) ? (
                        <p className="mt-2 text-sm font-medium text-primary">Você já tem este plano</p>
                      ) : (
                        <Button
                          size="sm"
                          className="mt-2 self-start"
                          onClick={() => {
                            setSubscribePlanId(plan.id);
                            setPaymentMethod('pix');
                            setSubscriptionPaymentResult(null);
                          }}
                        >
                          Assinar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={!!subscribePlanId}
        onOpenChange={(open) => {
          if (!open && !subscribingPlanId) {
            setSubscribePlanId(null);
            setSubscriptionPaymentResult(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assinar plano</DialogTitle>
            <DialogDescription>Selecione a forma de pagamento para continuar.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <select
              className="h-10 w-full rounded border border-input bg-background px-2 text-sm text-foreground"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as 'pix' | 'credito' | 'debito')}
              disabled={!!subscribingPlanId}
            >
              <option value="pix">PIX</option>
              <option value="credito">Crédito</option>
              <option value="debito">Débito</option>
            </select>

            {subscriptionPaymentResult?.qrCodeImageUrl ? (
              <div className="rounded border p-3">
                <p className="text-sm font-medium">Pagamento PIX gerado</p>
                <img
                  src={subscriptionPaymentResult.qrCodeImageUrl}
                  alt="QR Code PIX"
                  className="mt-2 h-48 w-48 rounded border object-contain"
                />
                {subscriptionPaymentResult.qrCodeText ? (
                  <textarea
                    readOnly
                    value={subscriptionPaymentResult.qrCodeText}
                    className="mt-2 h-24 w-full rounded border border-input bg-background p-2 text-xs text-foreground"
                  />
                ) : null}
              </div>
            ) : null}

            {subscriptionPaymentResult?.paymentUrl ? (
              <div className="rounded border p-3">
                <p className="text-sm font-medium">Link de pagamento gerado</p>
                <a
                  href={subscriptionPaymentResult.paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm font-medium text-primary underline"
                >
                  Abrir link de pagamento
                </a>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (subscribingPlanId) return;
                setSubscribePlanId(null);
                setSubscriptionPaymentResult(null);
              }}
              disabled={!!subscribingPlanId}
            >
              Fechar
            </Button>
            <Button onClick={handleSubscribePlan} disabled={!!subscribingPlanId || !subscribePlanId}>
              {subscribingPlanId ? 'Processando...' : 'Gerar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerDashboard;
