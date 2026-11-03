import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Clock,
  Gift,
  Home,
  LogOut,
  MapPin,
  Repeat2,
  Scissors,
  Star,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { customerPortalService, rotaLoginCliente } from '@/services/customer-portal';
import {
  CustomerAppointment,
  CustomerBookingOptionsResponse,
  CustomerLoyaltyResponse,
  CustomerPaymentGatewayResult,
  CustomerPlanCatalogItem,
  CustomerSubscription,
} from '@/types/customer-portal';
import { formatarData, formatarDiaHora, formatarDiaHoraTitulo } from '@/lib/horario';
import { corDoProfissional, iniciais, nomeCurto } from '@/lib/profissional';
import { AtivarNotificacoes } from '@/components/notificacoes/AtivarNotificacoes';
import { LogoMarca } from '@/components/Logo';
import { lerAgendamentoPendente } from '@/lib/agendamento-pendente';
import AvaliarAtendimento from '@/components/avaliacao/AvaliarAtendimento';
import { Estrelas } from '@/components/avaliacao/Estrelas';
import PassosAgendamento, {
  ESCOLHA_VAZIA,
  EscolhaAgendamento,
  HorarioLivre,
  iconeDoServico,
  reais,
} from '@/components/agenda/PassosAgendamento';

/**
 * Portal do cliente no visual do prototipo (design-references/image.png):
 * cartao dourado em destaque, servicos em blocos, barbeiros em lista e o menu
 * fixo embaixo — Inicio, Agendar, Horarios e Conta.
 *
 * Cada aba responde uma pergunta so. Antes era uma pagina longa com abas
 * "Horarios" e "Planos", e o formulario de marcar ficava no meio da lista.
 */

/**
 * Hora da barbearia, sempre.
 *
 * O cliente pode abrir o portal de qualquer lugar; o corte e no horario da
 * loja. Formatando pelo fuso do aparelho, o mesmo agendamento aparecia com
 * uma hora para o cliente e outra para o barbeiro.
 */
const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return formatarDiaHoraTitulo(value) || '-';
};

const formatCurrency = (value?: number | null) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// O cliente le "Confirmado", nao "confirmado" nem "no_show".
const STATUS_AGENDAMENTO: Record<string, { texto: string; classe: string }> = {
  pendente: { texto: 'Aguardando a barbearia', classe: 'border-amber-500/40 text-amber-700' },
  confirmado: { texto: 'Confirmado', classe: 'border-emerald-500/40 text-emerald-700' },
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

const resumoPlano = (plan: { is_unlimited: boolean; included_services?: number | null }) =>
  plan.is_unlimited
    ? 'Serviços ilimitados no período'
    : plan.included_services
      ? `${plan.included_services} serviços no período`
      : '';

type Aba = 'inicio' | 'agendar' | 'horarios' | 'conta';

const ABAS: Array<{ id: Aba; rotulo: string; icone: React.ElementType }> = [
  { id: 'inicio', rotulo: 'Início', icone: Home },
  { id: 'agendar', rotulo: 'Agendar', icone: CalendarPlus },
  { id: 'horarios', rotulo: 'Horários', icone: CalendarDays },
  { id: 'conta', rotulo: 'Conta', icone: User },
];

type Profissional = CustomerBookingOptionsResponse['professionals'][number];

const FotoBarbeiro: React.FC<{ profissional?: Profissional | null; nome?: string | null; className?: string }> = ({
  profissional,
  nome,
  className,
}) => (
  <Avatar className={cn('rounded-xl', className)}>
    <AvatarImage src={profissional?.avatar_url || undefined} alt={nome || ''} className="object-cover" />
    <AvatarFallback
      style={corDoProfissional(profissional?.id || nome || '?')}
      className="rounded-xl font-semibold"
    >
      {iniciais(nome || profissional?.name || '?')}
    </AvatarFallback>
  </Avatar>
);

const CustomerDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [plansCatalog, setPlansCatalog] = useState<CustomerPlanCatalogItem[]>([]);
  const [bookingOptions, setBookingOptions] = useState<CustomerBookingOptionsResponse | null>(null);
  const [escolha, setEscolha] = useState<EscolhaAgendamento>(ESCOLHA_VAZIA);
  const [availableSlots, setAvailableSlots] = useState<HorarioLivre[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelando, setCancelando] = useState<CustomerAppointment | null>(null);
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
  const [fidelidade, setFidelidade] = useState<CustomerLoyaltyResponse | null>(null);
  const [aba, setAba] = useState<Aba>('inicio');

  const irPara = (proxima: Aba) => {
    setAba(proxima);
    window.scrollTo({ top: 0 });
  };

  const loadData = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      customerPortalService.appointments(),
      customerPortalService.subscriptions(),
      customerPortalService.bookingOptions(),
      customerPortalService.plans(),
    ]);
    const [appointmentsData, subscriptionsData, bookingData, plansData] = results;
    if (appointmentsData.status === 'fulfilled') setAppointments(appointmentsData.value);
    if (subscriptionsData.status === 'fulfilled') setSubscriptions(subscriptionsData.value);
    if (bookingData.status === 'fulfilled') setBookingOptions(bookingData.value);
    if (plansData.status === 'fulfilled') setPlansCatalog(plansData.value);

    // Fidelidade fora do allSettled de cima: barbearia sem o programa nao e
    // erro, e nao pode virar o aviso vermelho de "dados nao carregados".
    customerPortalService
      .loyalty()
      .then(setFidelidade)
      .catch(() => setFidelidade(null));

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
      if (!escolha.service_id || !escolha.professional_id || !escolha.date) {
        setAvailableSlots([]);
        return;
      }
      setLoadingSlots(true);
      try {
        const data = await customerPortalService.appointmentSlots({
          date: escolha.date,
          service_id: escolha.service_id,
          professional_id: escolha.professional_id,
        });
        setAvailableSlots(Array.isArray(data.slots) ? data.slots : []);
      } catch (error: any) {
        setAvailableSlots([]);
        toast.error(error.message || 'Erro ao carregar horários disponíveis');
      } finally {
        setLoadingSlots(false);
      }
    };

    loadSlots();
  }, [escolha.service_id, escolha.professional_id, escolha.date]);

  const mudarEscolha = useCallback((proxima: EscolhaAgendamento) => setEscolha(proxima), []);

  const canCancelStatus = useMemo(() => new Set(['pendente', 'confirmado']), []);

  const handleCreateAppointment = async () => {
    if (!escolha.scheduled_at) return;
    setCreatingAppointment(true);
    try {
      const criado = await customerPortalService.createAppointment({
        service_id: escolha.service_id,
        professional_id: escolha.professional_id,
        scheduled_at: escolha.scheduled_at,
      });
      toast.success(criado.professional_name ? `Horário marcado com ${criado.professional_name}!` : 'Horário marcado!');
      setEscolha(ESCOLHA_VAZIA);
      setAvailableSlots([]);
      irPara('inicio');
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível agendar');
    } finally {
      setCreatingAppointment(false);
    }
  };

  // Cancelar pede confirmacao num dialogo do app: o window.confirm do
  // navegador some atras do teclado em alguns Android e parecia travado.
  const confirmarCancelamento = async () => {
    if (!cancelando) return;
    setCancelingId(cancelando.id);
    try {
      await customerPortalService.cancelAppointment(cancelando.id);
      toast.success('Horário cancelado');
      setCancelando(null);
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

  const servicos = bookingOptions?.services || [];
  const profissionais = bookingOptions?.professionals || [];
  const profissionalPorId = (id?: string | null) => profissionais.find((item) => item.id === id) || null;

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
  const agendaDisponivel = Boolean(servicos.length && profissionais.length);

  // O mais recente primeiro: e o corte que o cliente ainda lembra.
  const paraAvaliar = appointments.find((item) => item.can_review);

  // "Barbeiro da semana" do prototipo: o mais bem avaliado (o backend so manda
  // nota a partir de 3 avaliacoes); sem notas, o primeiro com foto.
  const destaque =
    [...profissionais]
      .filter((item) => item.rating)
      .sort((a, b) => (b.rating?.media || 0) - (a.rating?.media || 0))[0] ||
    profissionais.find((item) => item.avatar_url) ||
    profissionais[0] ||
    null;

  // Resumo do cliente, tirado do proprio historico. E o que ele quer saber
  // ao abrir o app sem horario marcado: quando cortou, com quem, e se esta na
  // hora de voltar.
  const DIA_MS = 24 * 60 * 60 * 1000;
  const visitas = appointments
    .filter((item) => item.status === 'concluido')
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  const ultimaVisita = visitas[0];
  const diasDesdeUltima = ultimaVisita
    ? Math.max(0, Math.floor((agora - new Date(ultimaVisita.scheduled_at).getTime()) / DIA_MS))
    : null;
  // Intervalo medio entre visitas, so com historico suficiente para nao
  // chutar: tres visitas dao dois intervalos.
  const intervaloMedio =
    visitas.length >= 3
      ? Math.round(
          (new Date(visitas[0].scheduled_at).getTime() - new Date(visitas[visitas.length - 1].scheduled_at).getTime()) /
            DIA_MS /
            (visitas.length - 1)
        )
      : null;
  const contagem = (lista: Array<string | null | undefined>) => {
    const mapa = new Map<string, number>();
    for (const valor of lista) if (valor) mapa.set(valor, (mapa.get(valor) || 0) + 1);
    return [...mapa.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  };
  const barbeiroFavoritoId = contagem(visitas.map((item) => item.professional_id));
  const barbeiroFavorito = profissionalPorId(barbeiroFavoritoId);
  const servicoDoUltimo = servicos.find((item) => item.id === ultimaVisita?.service_id) || null;
  const profissionalDoUltimo = profissionalPorId(ultimaVisita?.professional_id);
  const minhasAvaliacoes = appointments.filter((item) => item.review);
  const notaBarbearia = bookingOptions?.company_rating || null;
  const fidelidadeAtiva = Boolean(fidelidade?.settings?.is_active);
  const pontos = fidelidade?.profile?.points_balance || 0;
  const faltamParaGratis =
    fidelidadeAtiva && fidelidade?.settings?.tenth_service_free
      ? 10 - ((fidelidade?.profile?.total_services_count || 0) % 10)
      : null;
  // Data ja passada vira "ja passou da sua media": "voltar por volta de 05/09"
  // lido em 20/09 parecia erro do app.
  const voltaPrevista =
    ultimaVisita && intervaloMedio
      ? diasDesdeUltima !== null && diasDesdeUltima > intervaloMedio
        ? `Já passou da sua média de ${intervaloMedio} dias`
        : `Você costuma voltar por volta de ${formatarData(
            new Date(new Date(ultimaVisita.scheduled_at).getTime() + intervaloMedio * DIA_MS)
          ).slice(0, 5)}`
      : null;

  const agendarCom = (parcial: Partial<EscolhaAgendamento>) => {
    setEscolha({ ...ESCOLHA_VAZIA, ...parcial });
    irPara('agendar');
  };

  const primeiroNome = customer?.name?.split(' ')[0] || '';

  const linhaAgendamento = (item: CustomerAppointment) => {
    const status = statusAgendamento(item.status);
    const futuro = proximos.includes(item);
    return (
      <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card">
        <FotoBarbeiro
          profissional={profissionalPorId(item.professional_id)}
          nome={item.professional_name}
          className="h-14 w-14"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{item.service_name || 'Serviço'}</p>
          <p className="truncate text-xs text-muted-foreground">{item.professional_name || 'Barbeiro'}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDateTime(item.scheduled_at)}
          </p>
          {/* "Aguardando confirmacao" sozinho fazia o cliente achar que faltava
              algo da parte dele. */}
          {futuro && item.status === 'pendente' ? (
            <p className="mt-0.5 text-[11px] text-amber-700">A barbearia ainda vai confirmar. Você não precisa fazer nada.</p>
          ) : null}
          {item.review ? <Estrelas nota={item.review.rating} className="mt-1" /> : null}
        </div>
        {item.can_review ? (
          <Button size="sm" className="shrink-0 rounded-full" onClick={() => setAvaliando(item)}>
            <Star className="mr-1 h-3.5 w-3.5" />
            Avaliar
          </Button>
        ) : futuro ? (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 rounded-full text-muted-foreground"
            onClick={() => setCancelando(item)}
          >
            Cancelar
          </Button>
        ) : (
          <Badge variant="outline" className={`shrink-0 ${status.classe}`}>
            {status.texto}
          </Badge>
        )}
      </div>
    );
  };

  const tituloSecao = (titulo: string, acao?: { rotulo: string; onClick: () => void }) => (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {acao ? (
        <button type="button" onClick={acao.onClick} className="text-sm font-medium text-primary">
          {acao.rotulo}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          {company?.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-9 w-9 rounded-lg border border-border bg-card object-contain p-0.5"
            />
          ) : (
            <LogoMarca className="h-9 w-9" />
          )}
          <p className="flex min-w-0 flex-1 items-center justify-center gap-1 truncate text-sm font-semibold">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{company?.name || 'Minha barbearia'}</span>
          </p>
          <button
            type="button"
            aria-label="Minha conta"
            onClick={() => irPara('conta')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary"
          >
            {iniciais(customer?.name || '?')}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-32 pt-2">
        {aba === 'inicio' && (
          <div className="space-y-7">
            <p className="text-sm text-muted-foreground">
              Olá, <span className="font-semibold text-foreground">{primeiroNome}</span>
            </p>

            {/* O cartao dourado do prototipo. Com horario marcado ele mostra
                o horario: e o que o cliente abre o portal para saber. */}
            {proximo ? (
              <section className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-elevated">
                <div className="relative z-10 max-w-[62%]">
                  <h2 className="text-2xl font-bold leading-tight">Seu próximo horário</h2>
                  <p className="mt-2 text-sm font-medium">{formatDateTime(proximo.scheduled_at)}</p>
                  <p className="text-sm text-primary-foreground/85">
                    {proximo.service_name || 'Serviço'} com {proximo.professional_name || 'barbeiro'}
                  </p>
                  <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-foreground">
                    {statusAgendamento(proximo.status).texto}
                  </span>
                </div>
                <FotoBarbeiro
                  profissional={profissionalPorId(proximo.professional_id)}
                  nome={proximo.professional_name}
                  className="absolute bottom-4 right-4 top-4 h-auto w-[34%] rounded-2xl"
                />
              </section>
            ) : destaque ? (
              <section className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-elevated">
                <div className="relative z-10 max-w-[62%]">
                  <h2 className="text-2xl font-bold leading-tight">
                    {destaque.rating ? 'Barbeiro mais bem avaliado' : 'Marque seu próximo corte'}
                  </h2>
                  <p className="mt-1 text-sm font-medium">{destaque.name}</p>
                  {destaque.rating ? (
                    <span className="mt-1 flex items-center gap-1 text-xs">
                      <Estrelas nota={destaque.rating.media} />
                      <span className="text-primary-foreground/85">{destaque.rating.media.toFixed(1)}</span>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => agendarCom({ professional_id: destaque.id })}
                    disabled={!agendaDisponivel}
                    className="mt-3 inline-flex rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-foreground disabled:opacity-60"
                  >
                    Agendar com {nomeCurto(destaque.name)}
                  </button>
                </div>
                <FotoBarbeiro
                  profissional={destaque}
                  nome={destaque.name}
                  className="absolute bottom-4 right-4 top-4 h-auto w-[34%] rounded-2xl"
                />
              </section>
            ) : null}

            {paraAvaliar ? (
              <section className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <Star className="h-8 w-8 shrink-0 fill-amber-400 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Como foi seu último corte?</p>
                  <p className="text-xs text-muted-foreground">
                    Dê nota para {nomeCurto(paraAvaliar.professional_name) || 'o barbeiro'} e para a barbearia.
                    Leva 10 segundos e é anônimo para o barbeiro.
                  </p>
                </div>
                <Button size="sm" className="shrink-0 rounded-full" onClick={() => setAvaliando(paraAvaliar)}>
                  Avaliar
                </Button>
              </section>
            ) : null}

            {/* Resumo do cliente: so aparece depois da primeira visita, para o
                cliente novo nao ver um painel de zeros. */}
            {visitas.length > 0 ? (
              <section>
                {tituloSecao('Seu resumo')}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-card p-3 shadow-card">
                    <p className="text-2xl font-bold">{visitas.length}</p>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      {visitas.length === 1 ? 'visita' : 'visitas'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-card p-3 shadow-card">
                    <p className="text-2xl font-bold">{diasDesdeUltima === 0 ? 'Hoje' : `${diasDesdeUltima}d`}</p>
                    <p className="text-[11px] leading-tight text-muted-foreground">desde o último corte</p>
                  </div>
                  {fidelidadeAtiva ? (
                    <div className="rounded-2xl bg-card p-3 shadow-card">
                      {/* A coluna tem ~90px num celular de 320px: saldo de 4
                          digitos com o icone ao lado estourava o cartao. */}
                      <p className="flex min-w-0 items-center gap-1 text-2xl font-bold tabular-nums">
                        <span className="truncate">{pontos.toLocaleString('pt-BR')}</span>
                        <Gift className="h-4 w-4 shrink-0 text-primary" />
                      </p>
                      <p className="text-[11px] leading-tight text-muted-foreground">
                        {faltamParaGratis ? `faltam ${faltamParaGratis} para o grátis` : 'pontos de fidelidade'}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-card p-3 shadow-card">
                      <p className="truncate text-base font-bold leading-8">
                        {nomeCurto(barbeiroFavorito?.name) || '—'}
                      </p>
                      <p className="text-[11px] leading-tight text-muted-foreground">seu barbeiro</p>
                    </div>
                  )}
                </div>

                {/* Repetir o ultimo corte em um toque: e o que o cliente fiel faz
                    toda vez, e antes ele refazia os quatro passos. */}
                {!proximo && ultimaVisita && agendaDisponivel ? (
                  <button
                    type="button"
                    onClick={() =>
                      agendarCom({
                        service_id: servicoDoUltimo ? servicoDoUltimo.id : '',
                        professional_id: profissionalDoUltimo ? profissionalDoUltimo.id : '',
                      })
                    }
                    className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-left"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Repeat2 className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">Repetir o último corte</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {ultimaVisita.service_name || 'Serviço'} com {ultimaVisita.professional_name || 'barbeiro'}
                      </span>
                      {voltaPrevista ? (
                        <span className="block text-xs text-muted-foreground">{voltaPrevista}</span>
                      ) : null}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                ) : null}
              </section>
            ) : null}

            {/* Avaliacoes: a nota da casa (com avaliacoes suficientes) e as
                notas que o proprio cliente ja deu. */}
            {notaBarbearia || minhasAvaliacoes.length > 0 ? (
              <section>
                {tituloSecao('Avaliações')}
                {notaBarbearia ? (
                  <div className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-card">
                    <p className="text-4xl font-bold">{notaBarbearia.media.toFixed(1)}</p>
                    <div className="min-w-0">
                      <Estrelas nota={notaBarbearia.media} tamanho="h-4 w-4" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {company?.name || 'A barbearia'} · {notaBarbearia.total}{' '}
                        {notaBarbearia.total === 1 ? 'avaliação' : 'avaliações'} de clientes
                      </p>
                    </div>
                  </div>
                ) : null}
                {minhasAvaliacoes.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suas notas</p>
                    {minhasAvaliacoes.slice(0, 3).map((item) => (
                      <div key={item.id} className="rounded-2xl bg-card p-3 shadow-card">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">
                            {item.service_name || 'Serviço'} com {nomeCurto(item.professional_name) || 'barbeiro'}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatarData(item.scheduled_at).slice(0, 5)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Scissors className="h-3 w-3" /> Corte{' '}
                            <Estrelas nota={item.review?.rating || 0} tamanho="h-3 w-3" />
                          </span>
                          {item.review?.rating_empresa ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> Barbearia{' '}
                              <Estrelas nota={item.review.rating_empresa} tamanho="h-3 w-3" />
                            </span>
                          ) : null}
                        </div>
                        {item.review?.comment ? (
                          <p className="mt-1.5 line-clamp-2 text-xs italic text-muted-foreground">
                            "{item.review.comment}"
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {!agendaDisponivel ? (
              <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                A agenda online ainda não está aberta. Fale com a barbearia para marcar.
              </p>
            ) : (
              <>
                <section>
                  {tituloSecao('Serviços', { rotulo: 'Ver todos', onClick: () => irPara('agendar') })}
                  <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                    {servicos.map((servico) => {
                      const Icone = iconeDoServico(servico.name);
                      return (
                        <button
                          key={servico.id}
                          type="button"
                          onClick={() => agendarCom({ service_id: servico.id })}
                          className="flex w-[5.5rem] shrink-0 flex-col items-center gap-2 text-center"
                        >
                          <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-card shadow-card">
                            <Icone className="h-7 w-7 text-foreground" />
                          </span>
                          <span className="line-clamp-2 text-xs font-medium leading-tight">{servico.name}</span>
                          {reais(servico.price) ? (
                            <span className="-mt-1 text-[11px] text-muted-foreground">{reais(servico.price)}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  {tituloSecao('Barbeiros', { rotulo: 'Agendar', onClick: () => irPara('agendar') })}
                  <div className="space-y-3">
                    {profissionais.map((profissional) => (
                      <button
                        key={profissional.id}
                        type="button"
                        onClick={() => agendarCom({ professional_id: profissional.id })}
                        className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-card"
                      >
                        <FotoBarbeiro profissional={profissional} nome={profissional.name} className="h-16 w-16" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{profissional.name}</span>
                          <span className="mt-0.5 block text-xs font-medium uppercase tracking-wide text-emerald-600">
                            Toque para agendar
                          </span>
                          {profissional.rating ? (
                            <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              <span className="font-medium text-foreground">{profissional.rating.media.toFixed(1)}</span>
                              ({profissional.rating.total} avaliações)
                            </span>
                          ) : null}
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}

            <AtivarNotificacoes
              api={customerPortalService}
              textos={{
                ativo: 'Este aparelho recebe a confirmação e os lembretes dos seus horários.',
                convite: 'Receba a confirmação do agendamento e lembretes um dia, uma hora e 15 minutos antes.',
              }}
            />
          </div>
        )}

        {aba === 'agendar' && (
          <div className="pt-2">
            <h1 className="mb-5 text-2xl font-bold">Marcar horário</h1>
            {!agendaDisponivel ? (
              <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                A agenda online ainda não está aberta. Fale com a barbearia para marcar.
              </p>
            ) : (
              <PassosAgendamento
                servicos={servicos}
                profissionais={profissionais}
                valor={escolha}
                onChange={mudarEscolha}
                horarios={availableSlots}
                carregandoHorarios={loadingSlots}
              />
            )}
          </div>
        )}

        {aba === 'horarios' && (
          <div className="space-y-6 pt-2">
            <h1 className="text-2xl font-bold">Meus horários</h1>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Marcados</h2>
              {proximos.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum horário marcado.</p>
                  <Button className="mt-3 rounded-full" onClick={() => irPara('agendar')} disabled={!agendaDisponivel}>
                    Marcar horário
                  </Button>
                </div>
              ) : (
                proximos.map(linhaAgendamento)
              )}
            </section>
            {historico.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">Histórico</h2>
                {historico.map(linhaAgendamento)}
              </section>
            )}
          </div>
        )}

        {aba === 'conta' && (
          <div className="space-y-6 pt-2">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
                {iniciais(customer?.name || '?')}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold">{customer?.name}</h1>
                <p className="truncate text-sm text-muted-foreground">{company?.name}</p>
              </div>
            </div>

            {/* Primeiro o que o cliente ja tem; depois o que pode contratar. */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Seu plano</h2>
              {subscriptions.length === 0 ? (
                <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Você ainda não tem plano.
                </p>
              ) : (
                subscriptions.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-card p-4 shadow-card">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{item.plan?.name || 'Plano removido'}</p>
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
            </section>

            {plansCatalog.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">Planos da barbearia</h2>
                {plansCatalog.map((plan) => (
                  <div key={plan.id} className="flex flex-col rounded-2xl bg-card p-4 shadow-card">
                    <p className="font-semibold">{plan.name}</p>
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
                        className="mt-3 self-start rounded-full"
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
              </section>
            )}

            <AtivarNotificacoes
              api={customerPortalService}
              textos={{
                ativo: 'Este aparelho recebe a confirmação e os lembretes dos seus horários.',
                convite: 'Receba a confirmação do agendamento e lembretes um dia, uma hora e 15 minutos antes.',
              }}
            />

            <Button variant="outline" className="h-12 w-full rounded-full" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        )}
      </main>

      <AvaliarAtendimento
        atendimento={avaliando}
        nomeBarbearia={company?.name}
        onClose={() => setAvaliando(null)}
        onAvaliado={() => {
          setAvaliando(null);
          loadData();
        }}
      />

      {/* Rodape fixo: na aba Agendar, o botao de confirmar fica em cima do
          menu, sempre a vista. */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-card shadow-[0_-4px_24px_-8px_hsl(0_0%_0%/0.15)]">
        {aba === 'agendar' && agendaDisponivel ? (
          <div className="mx-auto max-w-xl border-b border-border/60 px-4 pb-3 pt-3">
            <button
              type="button"
              onClick={handleCreateAppointment}
              disabled={creatingAppointment || !escolha.scheduled_at}
              className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:bg-muted disabled:text-muted-foreground"
            >
              {creatingAppointment
                ? 'Agendando...'
                : escolha.scheduled_at
                  ? `Confirmar ${formatarDiaHora(escolha.scheduled_at)}`
                  : 'Escolha um horário'}
            </button>
          </div>
        ) : null}
        <nav className="mx-auto grid max-w-xl grid-cols-4 pb-[env(safe-area-inset-bottom)]" aria-label="Menu">
          {ABAS.map((item) => {
            const ativo = aba === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => irPara(item.id)}
                aria-current={ativo ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  ativo ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icone className={cn('h-5 w-5', ativo && 'fill-primary/15')} />
                {item.rotulo}
                {item.id === 'horarios' && proximos.length > 0 ? (
                  <span className="absolute right-[calc(50%-18px)] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {proximos.length}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <Dialog open={!!cancelando} onOpenChange={(open) => !open && !cancelingId && setCancelando(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Cancelar este horário?</DialogTitle>
            <DialogDescription>
              {cancelando
                ? `${cancelando.service_name || 'Serviço'} com ${cancelando.professional_name || 'o barbeiro'}, ${formatarDiaHora(cancelando.scheduled_at)}.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-full" onClick={() => setCancelando(null)} disabled={!!cancelingId}>
              Manter horário
            </Button>
            <Button variant="destructive" className="rounded-full" onClick={confirmarCancelamento} disabled={!!cancelingId}>
              {cancelingId ? 'Cancelando...' : 'Sim, cancelar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
