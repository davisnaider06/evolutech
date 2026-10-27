import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, LogIn, MapPin, UserPlus } from 'lucide-react';
import { appointmentsService } from '@/services/appointments';
import { formatarDiaHoraTitulo } from '@/lib/horario';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { lembrarEmpresaDoCliente } from '@/services/customer-portal';
import { lembrarTipoAcesso, tipoAcessoLembrado } from '@/lib/tipo-acesso';
import { guardarAgendamentoPendente, lerAgendamentoPendente } from '@/lib/agendamento-pendente';
import { ProfissionalOpcao, QUALQUER_BARBEIRO, ROTULO_QUALQUER_BARBEIRO } from '@/components/agenda/EscolhaProfissional';
import PassosAgendamento, {
  ESCOLHA_VAZIA,
  EscolhaAgendamento,
  HorarioLivre,
  ServicoOpcao,
  reais,
} from '@/components/agenda/PassosAgendamento';
import {
  PontosFoto,
  TelaComFoto,
  TituloFoto,
  botaoFoto,
  botaoFotoContorno,
  linkFoto,
} from '@/components/telas/TelaComFoto';

type Etapa = 'boas-vindas' | 'agendar' | 'conta';

const AgendamentoCliente: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const slugNormalizado = slug.trim().toLowerCase();
  const navigate = useNavigate();
  const sessaoCliente = useCustomerAuth();
  const jaLogadoAqui = sessaoCliente.isAuthenticated && sessaoCliente.company?.slug === slugNormalizado;

  // Quem volta para trocar o horario (ou ja esta logado) pula a capa: ela e
  // so para quem chega pelo link pela primeira vez.
  const [etapa, setEtapa] = useState<Etapa>(() =>
    lerAgendamentoPendente(slug) ? 'agendar' : 'boas-vindas'
  );
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [services, setServices] = useState<ServicoOpcao[]>([]);
  const [professionals, setProfessionals] = useState<ProfissionalOpcao[]>([]);
  const [slots, setSlots] = useState<HorarioLivre[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [escolha, setEscolha] = useState<EscolhaAgendamento>(ESCOLHA_VAZIA);

  useEffect(() => {
    if (!sessaoCliente.isLoading && jaLogadoAqui) setEtapa((atual) => (atual === 'boas-vindas' ? 'agendar' : atual));
  }, [sessaoCliente.isLoading, jaLogadoAqui]);

  useEffect(() => {
    const loadCompany = async () => {
      try {
        setLoadingOptions(true);
        const options = await appointmentsService.getPublicBookingOptions(slug);
        setCompanyName(options.company?.name || '');
        // Quem abriu pelo link e instalou o app volta para esta barbearia ao
        // abrir o app. So vale num aparelho que ainda nao tem lado: o dono que
        // testa o proprio link continua abrindo no painel.
        lembrarEmpresaDoCliente(slugNormalizado);
        if (!tipoAcessoLembrado()) lembrarTipoAcesso('cliente');
        setServices(options.services || []);
        setProfessionals(options.professionals || []);
        // Voltou da confirmacao para trocar o horario (ou o horario foi pego
        // por outro): servico, barbeiro e dia ja vem escolhidos.
        const pendente = lerAgendamentoPendente(slug);
        if (pendente) {
          setEscolha({
            service_id: pendente.service_id,
            professional_id: pendente.professional_id,
            date: pendente.date,
            scheduled_at: '',
          });
        }
      } catch (err: any) {
        setError(err.message || 'Link de agendamento inválido');
      } finally {
        setLoadingOptions(false);
      }
    };

    if (slug) {
      loadCompany();
    } else {
      setError('Link de agendamento inválido');
      setLoadingOptions(false);
    }
  }, [slug, slugNormalizado]);

  useEffect(() => {
    const loadSlots = async () => {
      if (!slug || !escolha.date || !escolha.service_id || !escolha.professional_id) {
        setSlots([]);
        return;
      }
      try {
        setLoadingSlots(true);
        setError('');
        const result = await appointmentsService.listPublicAvailableSlots(slug, {
          date: escolha.date,
          service_id: escolha.service_id,
          professional_id: escolha.professional_id,
        });
        // Nenhum horario vem marcado: antes o primeiro (09:30) era escolhido
        // sozinho e quem nao reparava agendava no horario errado.
        setSlots(Array.isArray(result?.slots) ? result.slots : []);
      } catch (err: any) {
        setSlots([]);
        setError(err.message || 'Erro ao carregar horários disponíveis');
      } finally {
        setLoadingSlots(false);
      }
    };
    loadSlots();
  }, [slug, escolha.date, escolha.service_id, escolha.professional_id]);

  const mudarEscolha = useCallback((proxima: EscolhaAgendamento) => setEscolha(proxima), []);

  const selectedService = services.find((item) => item.id === escolha.service_id);
  const selectedProfessional = professionals.find((item) => item.id === escolha.professional_id);
  const nomeBarbeiro =
    escolha.professional_id === QUALQUER_BARBEIRO ? ROTULO_QUALQUER_BARBEIRO : selectedProfessional?.name;

  // A conta so e pedida aqui, no fim: o cliente ja viu servico, barbeiro e
  // horario livre. O horario fica guardado e, depois de entrar ou terminar o
  // cadastro, ele so confirma o resumo. Quem ja esta logado vai direto.
  const continuar = () => {
    if (!escolha.scheduled_at) return;
    guardarAgendamentoPendente({
      slug: slugNormalizado,
      service_id: escolha.service_id,
      professional_id: escolha.professional_id,
      date: escolha.date,
      scheduled_at: escolha.scheduled_at,
      service_name: selectedService?.name,
      professional_name: nomeBarbeiro,
    });
    if (jaLogadoAqui) {
      navigate(`/agendar/${slugNormalizado}/confirmar`);
      return;
    }
    setEtapa('conta');
    window.scrollTo({ top: 0 });
  };

  if (etapa === 'boas-vindas') {
    return (
      <TelaComFoto>
        <TituloFoto
          linha="Agende na"
          destaque={companyName || (loadingOptions ? '...' : 'Barbearia')}
          descricao={
            error && !loadingOptions
              ? error
              : 'Escolha o serviço, o barbeiro e o horário. Leva menos de um minuto.'
          }
        />
        <PontosFoto total={3} ativo={0} />
        <button
          type="button"
          className={`${botaoFoto} mt-8`}
          disabled={loadingOptions || Boolean(error)}
          onClick={() => setEtapa('agendar')}
        >
          Agendar horário
        </button>
        <p className="mt-5 text-center text-sm text-white/80">
          Já tem conta?{' '}
          <Link className={linkFoto} to={`/cliente/${slugNormalizado}/login`}>
            Entrar
          </Link>
        </p>
      </TelaComFoto>
    );
  }

  if (etapa === 'conta') {
    return (
      <TelaComFoto>
        <TituloFoto linha="Falta só" destaque="Sua conta" />
        {/* O resumo fica a vista: o cliente ve que nada se perdeu. */}
        <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4 text-center backdrop-blur-md">
          <p className="text-xl font-bold">{formatarDiaHoraTitulo(escolha.scheduled_at)}</p>
          <p className="mt-1 text-sm text-white/80">
            {selectedService?.name || 'Serviço'} com {nomeBarbeiro || 'barbeiro'}
          </p>
          <p className="mt-2 text-xs text-white/60">Seu horário fica guardado enquanto você entra.</p>
        </div>
        <Link to={`/cliente/${slugNormalizado}/cadastro`} className={`${botaoFoto} mt-6`}>
          <UserPlus className="h-5 w-5" />
          Criar minha conta
        </Link>
        <Link to={`/cliente/${slugNormalizado}/login`} className={`${botaoFotoContorno} mt-3`}>
          <LogIn className="h-5 w-5" />
          Já tenho conta
        </Link>
        <button
          type="button"
          className="mt-4 text-center text-sm text-white/70 underline"
          onClick={() => setEtapa('agendar')}
        >
          Voltar e trocar o horário
        </button>
      </TelaComFoto>
    );
  }

  // Ordem pensada para o celular: primeiro o que o cliente quer (servico,
  // barbeiro, dia e hora), e so no fim a conta. Pedir cadastro antes de
  // mostrar qualquer horario faz o cliente desistir antes de ver valor.
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => setEtapa('boas-vindas')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Agendar em</p>
            <p className="flex items-center gap-1 truncate font-semibold">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              {companyName || 'Barbearia'}
            </p>
          </div>
          <Link
            to={jaLogadoAqui ? '/cliente/dashboard' : `/cliente/${slugNormalizado}/login`}
            className="text-sm font-semibold text-primary"
          >
            {jaLogadoAqui ? 'Meus horários' : 'Entrar'}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-40 pt-5">
        {error && (
          <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <PassosAgendamento
          servicos={services}
          profissionais={professionals}
          valor={escolha}
          onChange={mudarEscolha}
          horarios={slots}
          carregandoHorarios={loadingSlots}
          carregando={loadingOptions}
        />
      </main>

      {/* Barra fixa: o resumo do que ja foi escolhido e o botao, sempre a
          vista — no formulario antigo o botao ficava la embaixo e quem nao
          rolava a tela achava que tinha terminado. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
          <p className="mb-2 truncate text-center text-xs text-muted-foreground">
            {escolha.scheduled_at
              ? `${formatarDiaHoraTitulo(escolha.scheduled_at)} · ${selectedService?.name || ''} ${reais(selectedService?.price) ? `· ${reais(selectedService?.price)}` : ''}`
              : 'Você entra ou cria sua conta no próximo passo.'}
          </p>
          <button
            type="button"
            onClick={continuar}
            disabled={!escolha.scheduled_at}
            className="flex h-14 w-full items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.98] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            {escolha.scheduled_at ? 'Continuar' : 'Escolha um horário'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgendamentoCliente;
