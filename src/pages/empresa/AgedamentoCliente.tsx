import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck, LogIn, UserPlus } from 'lucide-react';
import { appointmentsService } from '@/services/appointments';
import { formatarDataHora, hojeNaBarbearia } from '@/lib/horario';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { lembrarEmpresaDoCliente } from '@/services/customer-portal';
import { guardarAgendamentoPendente, lerAgendamentoPendente } from '@/lib/agendamento-pendente';
import EscolhaProfissional, { ProfissionalOpcao } from '@/components/agenda/EscolhaProfissional';

interface AppointmentInput {
  service_id: string;
  professional_id: string;
  scheduled_at: string;
}

interface BookingOption {
  id: string;
  name: string;
  duration_minutes?: number;
  price?: number;
}

const formatarPreco = (valor?: number) =>
  Number(valor || 0) > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor))
    : '';

// Dois servicos com o mesmo nome ("Corte" e "Corte") so se distinguem pela
// duracao e pelo preco: sem isso no rotulo, o cliente escolhe no escuro.
const rotuloServico = (service: BookingOption) => {
  const detalhes = [
    service.duration_minutes ? `${service.duration_minutes} min` : '',
    formatarPreco(service.price),
  ].filter(Boolean);
  return detalhes.length ? `${service.name} — ${detalhes.join(' · ')}` : service.name;
};

interface SlotItem {
  time: string;
  scheduled_at: string;
}

const AgendamentoCliente: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const sessaoCliente = useCustomerAuth();
  // Agendamento montado, falta so a conta: mostra entrar / cadastrar.
  const [pedindoConta, setPedindoConta] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [services, setServices] = useState<BookingOption[]>([]);
  const [professionals, setProfessionals] = useState<ProfissionalOpcao[]>([]);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  const [formData, setFormData] = useState<AppointmentInput>({
    service_id: '',
    professional_id: '',
    scheduled_at: '',
  });

  useEffect(() => {
    const loadCompany = async () => {
      try {
        setLoadingOptions(true);
        const options = await appointmentsService.getPublicBookingOptions(slug);
        setCompanyName(options.company?.name || '');
        // Quem abriu pelo link volta para esta barbearia ao tocar em "Sou cliente".
        lembrarEmpresaDoCliente(slug.trim().toLowerCase());
        setServices(options.services || []);
        setProfessionals(options.professionals || []);
        // Voltou da confirmacao para trocar o horario (ou o horario foi pego
        // por outro): servico, barbeiro e dia ja vem escolhidos.
        const pendente = lerAgendamentoPendente(slug);
        if (pendente) {
          setFormData({
            service_id: pendente.service_id,
            professional_id: pendente.professional_id,
            scheduled_at: '',
          });
          setSelectedDate(pendente.date);
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
    }
  }, [slug]);

  // Hoje na barbearia. toISOString() e UTC: depois das 21h o campo ja
  // liberava o dia seguinte, e antes disso podia travar o dia de hoje.
  const minDate = useMemo(() => hojeNaBarbearia(), []);

  useEffect(() => {
    const loadSlots = async () => {
      if (!slug || !selectedDate || !formData.service_id || !formData.professional_id) {
        setSlots([]);
        setFormData((prev) => ({ ...prev, scheduled_at: '' }));
        return;
      }
      try {
        setLoadingSlots(true);
        setError('');
        const result = await appointmentsService.listPublicAvailableSlots(slug, {
          date: selectedDate,
          service_id: formData.service_id,
          professional_id: formData.professional_id,
        });
        const slotList = Array.isArray(result?.slots) ? result.slots : [];
        setSlots(slotList);
        // Nenhum horario vem marcado: antes o primeiro (09:30) era escolhido
        // sozinho e quem nao reparava agendava no horario errado.
        setFormData((prev) => ({ ...prev, scheduled_at: '' }));
      } catch (err: any) {
        setSlots([]);
        setFormData((prev) => ({ ...prev, scheduled_at: '' }));
        setError(err.message || 'Erro ao carregar horários disponíveis');
      } finally {
        setLoadingSlots(false);
      }
    };
    loadSlots();
  }, [slug, selectedDate, formData.service_id, formData.professional_id]);

  const slugNormalizado = slug.trim().toLowerCase();
  const selectedService = services.find((item) => item.id === formData.service_id);
  const selectedProfessional = professionals.find((item) => item.id === formData.professional_id);

  // A conta so e pedida aqui, no fim: o cliente ja viu servico, barbeiro e
  // horario livre. O horario fica guardado e, depois de entrar ou terminar o
  // cadastro, ele so confirma o resumo. Quem ja esta logado vai direto.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.scheduled_at) return;
    guardarAgendamentoPendente({
      slug: slugNormalizado,
      service_id: formData.service_id,
      professional_id: formData.professional_id,
      date: selectedDate,
      scheduled_at: formData.scheduled_at,
      service_name: selectedService?.name,
      professional_name: selectedProfessional?.name,
    });
    if (sessaoCliente.isAuthenticated && sessaoCliente.company?.slug === slugNormalizado) {
      navigate(`/agendar/${slugNormalizado}/confirmar`);
      return;
    }
    setPedindoConta(true);
  };

  const etapaHorarioPronta = Boolean(formData.service_id && formData.professional_id && selectedDate);
  const textoSemHorario = !etapaHorarioPronta
    ? 'Escolha serviço, profissional e data para ver os horários.'
    : loadingSlots
    ? 'Carregando horários...'
    : 'Nenhum horário livre nesse dia. Tente outra data ou outro profissional.';

  if (pedindoConta) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted p-3">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Falta só entrar na sua conta</CardTitle>
            {/* O resumo fica a vista: o cliente ve que nada se perdeu. */}
            <p className="text-2xl font-bold">{formatarDataHora(formData.scheduled_at)}</p>
            <CardDescription>
              <strong>{selectedService?.name || 'Serviço'}</strong> com{' '}
              <strong>{selectedProfessional?.name || 'profissional'}</strong>
              {companyName ? ` na ${companyName}` : ''}. Entre ou crie sua conta para confirmar.
              O horário fica guardado enquanto isso.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <div className="w-full space-y-3">
              <Button asChild className="w-full h-11 gap-2">
                <Link to={`/cliente/${slugNormalizado}/cadastro`}>
                  <UserPlus className="h-4 w-4" />
                  Criar minha conta
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full h-11 gap-2">
                <Link to={`/cliente/${slugNormalizado}/login`}>
                  <LogIn className="h-4 w-4" />
                  Já tenho conta
                </Link>
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground underline"
                onClick={() => setPedindoConta(false)}
              >
                Voltar e trocar o horário
              </button>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Ordem pensada para o celular: primeiro o que o cliente quer (servico,
  // barbeiro, dia e hora), e so no fim a conta. Pedir cadastro antes de
  // mostrar qualquer horario faz o cliente desistir antes de ver valor.
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted p-3">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="space-y-1 bg-primary text-primary-foreground rounded-t-lg">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-6 w-6" />
            <CardTitle className="text-2xl">Agende seu horário</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80">
            {companyName || 'Escolha o serviço, o profissional e o horário.'}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="pt-5 space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="service">1. Serviço</Label>
              <select
                id="service"
                required
                value={formData.service_id}
                onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                disabled={loadingOptions || services.length === 0}
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{loadingOptions ? 'Carregando serviços...' : 'Escolha o serviço'}</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {rotuloServico(service)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>2. Profissional</Label>
              <EscolhaProfissional
                profissionais={professionals}
                valor={formData.professional_id}
                onChange={(id) => setFormData({ ...formData, professional_id: id })}
                carregando={loadingOptions}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">3. Dia</Label>
              <Input
                id="date"
                type="date"
                required
                min={minDate}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="grid gap-2">
              <Label>4. Horário</Label>
              {slots.length > 0 ? (
                <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Horários livres">
                  {slots.map((slot) => {
                    const ativo = formData.scheduled_at === slot.scheduled_at;
                    return (
                      <button
                        key={slot.scheduled_at}
                        type="button"
                        role="radio"
                        aria-checked={ativo}
                        onClick={() => setFormData({ ...formData, scheduled_at: slot.scheduled_at })}
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
                  {textoSemHorario}
                </p>
              )}
            </div>

          </CardContent>

          <CardFooter>
            <div className="w-full space-y-3">
              {/* Sem `!!error` aqui: um erro passageiro (horarios que nao
                  carregaram) travava o botao ate recarregar a pagina. */}
              <Button
                type="submit"
                className="w-full h-11"
                disabled={
                  loadingOptions ||
                  loadingSlots ||
                  services.length === 0 ||
                  professionals.length === 0 ||
                  !formData.scheduled_at
                }
              >
                Confirmar agendamento
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Você entra ou cria sua conta no próximo passo.
              </p>
              {/* Quem so quer ver ou cancelar um horario ja marcado. */}
              <p className="text-xs text-muted-foreground text-center">
                <Link className="underline" to={`/cliente/${slugNormalizado}/login`}>
                  Ver meus horários marcados
                </Link>
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default AgendamentoCliente;
