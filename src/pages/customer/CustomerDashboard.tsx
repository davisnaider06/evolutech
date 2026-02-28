import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
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
import { customerPortalService } from '@/services/customer-portal';
import {
  CustomerAppointment,
  CustomerBookingOptionsResponse,
  CustomerCourseCatalogItem,
  CustomerCourseAccess,
  CustomerDashboardResponse,
  CustomerLoyaltyResponse,
  CustomerPaymentGatewayResult,
  CustomerPlanCatalogItem,
  CustomerSubscription,
} from '@/types/customer-portal';

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
};

const formatCurrency = (value?: number | null) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CustomerDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<CustomerDashboardResponse | null>(null);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [plansCatalog, setPlansCatalog] = useState<CustomerPlanCatalogItem[]>([]);
  const [loyalty, setLoyalty] = useState<CustomerLoyaltyResponse | null>(null);
  const [courses, setCourses] = useState<CustomerCourseAccess[]>([]);
  const [coursesCatalog, setCoursesCatalog] = useState<CustomerCourseCatalogItem[]>([]);
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
  const [purchasingCourseId, setPurchasingCourseId] = useState<string | null>(null);
  const { customer, company, logout } = useCustomerAuth();
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashboardData, appointmentsData, subscriptionsData, loyaltyData, coursesData, bookingData, plansData, availableCoursesData] =
        await Promise.all([
          customerPortalService.dashboard(),
          customerPortalService.appointments(),
          customerPortalService.subscriptions(),
          customerPortalService.loyalty(),
          customerPortalService.courses(),
          customerPortalService.bookingOptions(),
          customerPortalService.plans(),
          customerPortalService.availableCourses(),
        ]);
      setDashboard(dashboardData);
      setAppointments(appointmentsData);
      setSubscriptions(subscriptionsData);
      setLoyalty(loyaltyData);
      setCourses(coursesData);
      setBookingOptions(bookingData);
      setPlansCatalog(plansData);
      setCoursesCatalog(availableCoursesData);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar portal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
        toast.error(error.message || 'Erro ao carregar horarios disponiveis');
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
      toast.error('Preencha servico, profissional, data e horario');
      return;
    }
    setCreatingAppointment(true);
    try {
      await customerPortalService.createAppointment({
        service_id: appointmentForm.service_id,
        professional_id: appointmentForm.professional_id,
        scheduled_at: appointmentForm.scheduled_at,
      });
      toast.success('Agendamento criado com sucesso');
      setAppointmentForm({ service_id: '', professional_id: '', date: '', scheduled_at: '' });
      setAvailableSlots([]);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Nao foi possivel agendar');
    } finally {
      setCreatingAppointment(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!window.confirm('Deseja cancelar este agendamento?')) return;
    setCancelingId(appointmentId);
    try {
      await customerPortalService.cancelAppointment(appointmentId);
      toast.success('Agendamento cancelado');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Nao foi possivel cancelar');
    } finally {
      setCancelingId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/cliente/login', { replace: true });
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
      toast.success('Assinatura criada. Finalize o pagamento para ativacao.');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Falha ao assinar plano');
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const handlePurchaseCourse = async (courseId: string) => {
    setPurchasingCourseId(courseId);
    try {
      await customerPortalService.purchaseCourse(courseId);
      toast.success('Curso adquirido com sucesso');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Falha ao adquirir curso');
    } finally {
      setPurchasingCourseId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Portal do Cliente</h1>
            <p className="text-sm text-muted-foreground">
              {customer?.name} • {company?.name}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Sair
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Agendamentos</p><p className="text-xl font-bold">{dashboard?.summary.appointments_total || 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Proximos</p><p className="text-xl font-bold">{dashboard?.summary.upcoming_appointments || 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Assinaturas</p><p className="text-xl font-bold">{dashboard?.summary.active_subscriptions || 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cursos</p><p className="text-xl font-bold">{dashboard?.summary.active_courses || 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pontos</p><p className="text-xl font-bold">{dashboard?.summary.loyalty_points || 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cashback</p><p className="text-xl font-bold">{formatCurrency(dashboard?.summary.loyalty_cashback)}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="appointments" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
            <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
            <TabsTrigger value="loyalty">Fidelidade</TabsTrigger>
            <TabsTrigger value="courses">Cursos</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments">
            <Card>
              <CardHeader>
                <CardTitle>Meus Agendamentos</CardTitle>
                <CardDescription>Visualize e cancele agendamentos pendentes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <form className="grid gap-2 rounded border p-3 md:grid-cols-5" onSubmit={handleCreateAppointment}>
                  <select
                    className="h-10 rounded border border-input bg-background px-2 text-sm text-foreground"
                    value={appointmentForm.service_id}
                    onChange={(event) =>
                      setAppointmentForm((old) => ({
                        ...old,
                        service_id: event.target.value,
                        scheduled_at: '',
                      }))
                    }
                  >
                    <option value="">Servico</option>
                    {(bookingOptions?.services || []).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded border border-input bg-background px-2 text-sm text-foreground"
                    value={appointmentForm.professional_id}
                    onChange={(event) =>
                      setAppointmentForm((old) => ({
                        ...old,
                        professional_id: event.target.value,
                        scheduled_at: '',
                      }))
                    }
                  >
                    <option value="">Profissional</option>
                    {(bookingOptions?.professionals || []).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <input
                    className="h-10 rounded border border-input bg-background px-2 text-sm text-foreground"
                    type="date"
                    value={appointmentForm.date}
                    onChange={(event) =>
                      setAppointmentForm((old) => ({
                        ...old,
                        date: event.target.value,
                        scheduled_at: '',
                      }))
                    }
                  />
                  <select
                    className="h-10 rounded border border-input bg-background px-2 text-sm text-foreground"
                    value={appointmentForm.scheduled_at}
                    onChange={(event) => setAppointmentForm((old) => ({ ...old, scheduled_at: event.target.value }))}
                    disabled={
                      !appointmentForm.date ||
                      !appointmentForm.service_id ||
                      !appointmentForm.professional_id ||
                      loadingSlots
                    }
                  >
                    <option value="">
                      {loadingSlots
                        ? 'Carregando horarios...'
                        : !appointmentForm.date
                          ? 'Selecione a data'
                          : 'Selecione um horario'}
                    </option>
                    {availableSlots.map((slot) => (
                      <option key={slot.scheduled_at} value={slot.scheduled_at}>
                        {slot.time}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" disabled={creatingAppointment || !appointmentForm.scheduled_at}>
                    {creatingAppointment ? 'Agendando...' : 'Novo agendamento'}
                  </Button>
                </form>
                {appointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado.</p>
                ) : (
                  appointments.map((item) => (
                    <div key={item.id} className="flex flex-col gap-2 rounded border p-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{item.service_name || 'Servico nao informado'}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(item.scheduled_at)} • Profissional: {item.professional_name || '-'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.status}</Badge>
                        {canCancelStatus.has(item.status) && (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={cancelingId === item.id}
                            onClick={() => handleCancelAppointment(item.id)}
                          >
                            {cancelingId === item.id ? 'Cancelando...' : 'Cancelar'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions">
            <Card>
              <CardHeader>
                <CardTitle>Minhas Assinaturas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  {plansCatalog.map((plan) => (
                    <div key={plan.id} className="rounded border p-3">
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">{plan.description || '-'}</p>
                      <p className="text-sm">Valor: {formatCurrency(plan.price)}</p>
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setSubscribePlanId(plan.id);
                          setPaymentMethod('pix');
                          setSubscriptionPaymentResult(null);
                        }}
                      >
                        Assinar plano
                      </Button>
                    </div>
                  ))}
                </div>
                {subscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma assinatura encontrada.</p>
                ) : (
                  subscriptions.map((item) => (
                    <div key={item.id} className="rounded border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{item.plan?.name || 'Plano removido'}</p>
                        <Badge variant="outline">{item.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Inicio: {formatDateTime(item.start_at)} • Fim: {formatDateTime(item.end_at || undefined)}
                      </p>
                      <p className="text-sm">Valor: {formatCurrency(item.amount)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="loyalty">
            <Card>
              <CardHeader>
                <CardTitle>Fidelidade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Saldo de pontos</p><p className="text-xl font-bold">{loyalty?.profile?.points_balance || 0}</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Saldo cashback</p><p className="text-xl font-bold">{formatCurrency(loyalty?.profile?.cashback_balance || 0)}</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Servicos realizados</p><p className="text-xl font-bold">{loyalty?.profile?.total_services_count || 0}</p></CardContent></Card>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Ultimas movimentacoes</p>
                  {loyalty?.transactions?.length ? (
                    loyalty.transactions.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded border p-2 text-sm">
                        <span>{item.type}</span>
                        <span className="text-muted-foreground">{formatDateTime(item.created_at)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem movimentacoes recentes.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="courses">
            <Card>
              <CardHeader>
                <CardTitle>Meus Cursos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  {coursesCatalog.map((course) => (
                    <div key={course.id} className="rounded border p-3">
                      <p className="font-medium">{course.title}</p>
                      <p className="text-sm text-muted-foreground">{course.description || '-'}</p>
                      <p className="text-sm">Valor: {formatCurrency(course.price)}</p>
                      <Button
                        size="sm"
                        className="mt-2"
                        disabled={purchasingCourseId === course.id}
                        onClick={() => handlePurchaseCourse(course.id)}
                      >
                        {purchasingCourseId === course.id ? 'Processando...' : 'Comprar curso'}
                      </Button>
                    </div>
                  ))}
                </div>
                {courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum curso encontrado.</p>
                ) : (
                  courses.map((item) => (
                    <div key={item.access_id} className="rounded border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{item.course?.title || 'Curso removido'}</p>
                        <Badge variant="outline">{item.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Inicio: {formatDateTime(item.start_at)} • Fim: {formatDateTime(item.end_at || undefined)}
                      </p>
                      <p className="text-sm">Valor pago: {formatCurrency(item.amount_paid)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
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
              <option value="credito">Credito</option>
              <option value="debito">Debito</option>
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
