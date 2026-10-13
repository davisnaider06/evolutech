import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { appointmentsService } from '@/services/appointments';
import { formatarDataHora, hojeNaBarbearia } from '@/lib/horario';

interface AppointmentInput {
  customer_name: string;
  customer_phone: string;
  service_id: string;
  professional_id: string;
  scheduled_at: string;
  notes: string;
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
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [services, setServices] = useState<BookingOption[]>([]);
  const [professionals, setProfessionals] = useState<BookingOption[]>([]);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  const [formData, setFormData] = useState<AppointmentInput>({
    customer_name: '',
    customer_phone: '',
    service_id: '',
    professional_id: '',
    scheduled_at: '',
    notes: '',
  });

  useEffect(() => {
    const loadCompany = async () => {
      try {
        setLoadingOptions(true);
        const options = await appointmentsService.getPublicBookingOptions(slug);
        setCompanyName(options.company?.name || '');
        setServices(options.services || []);
        setProfessionals(options.professionals || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await appointmentsService.createPublicAppointment(slug, formData);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar agendamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const etapaHorarioPronta = Boolean(formData.service_id && formData.professional_id && selectedDate);
  const textoSemHorario = !etapaHorarioPronta
    ? 'Escolha serviço, profissional e data para ver os horários.'
    : loadingSlots
    ? 'Carregando horários...'
    : 'Nenhum horário livre nesse dia. Tente outra data ou outro profissional.';

  if (submitted) {
    const selectedService = services.find((item) => item.id === formData.service_id)?.name || 'serviço';
    const selectedProfessional = professionals.find((item) => item.id === formData.professional_id)?.name || 'profissional';

    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle>Agendamento solicitado!</CardTitle>
            {/* Dia e hora em destaque: antes a confirmacao nao dizia quando
                era, e o cliente fechava a pagina sem saber. */}
            <p className="text-2xl font-bold">{formatarDataHora(formData.scheduled_at)}</p>
            <CardDescription>
              {formData.customer_name}, seu pedido de <strong>{selectedService}</strong> com{' '}
              <strong>{selectedProfessional}</strong> foi enviado para {companyName || 'a barbearia'}.
              A barbearia vai confirmar o seu horário.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <div className="w-full space-y-3">
              <Button className="w-full" onClick={() => window.location.reload()}>
                Fazer novo agendamento
              </Button>
              <p className="text-sm text-muted-foreground">
                Quer acompanhar seus horários?{' '}
                <Link className="text-primary underline" to={`/cliente/${slug}/cadastro`}>
                  Crie sua conta
                </Link>
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Ordem pensada para o celular: primeiro o que o cliente quer (servico,
  // barbeiro, dia e hora), por ultimo quem ele e. Pedir nome e telefone antes
  // de mostrar qualquer horario faz o cliente desistir antes de ver valor.
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#020b1f] p-3">
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
              <Label htmlFor="professional">2. Profissional</Label>
              <select
                id="professional"
                required
                value={formData.professional_id}
                onChange={(e) => setFormData({ ...formData, professional_id: e.target.value })}
                disabled={loadingOptions || professionals.length === 0}
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{loadingOptions ? 'Carregando profissionais...' : 'Escolha o profissional'}</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
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

            <hr className="my-2 border-border" />

            <div className="grid gap-2">
              <Label htmlFor="name">Seu nome</Label>
              <Input
                id="name"
                placeholder="Ex: João Silva"
                required
                autoComplete="name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                required
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Alguma observação sobre o atendimento?"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
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
                  loading ||
                  loadingOptions ||
                  loadingSlots ||
                  services.length === 0 ||
                  professionals.length === 0 ||
                  !formData.scheduled_at
                }
              >
                {loading ? 'Enviando...' : 'Confirmar agendamento'}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Já é cliente?{' '}
                <Link className="text-primary underline" to={`/cliente/${slug}/login`}>
                  Entre na sua conta
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
