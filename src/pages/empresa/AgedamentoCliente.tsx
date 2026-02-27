import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { appointmentsService } from '@/services/appointments';

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
}

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
        setError(err.message || 'Link de agendamento invalido');
      } finally {
        setLoadingOptions(false);
      }
    };

    if (slug) {
      loadCompany();
    } else {
      setError('Link de agendamento invalido');
    }
  }, [slug]);

  const minDate = useMemo(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    const loadSlots = async () => {
      if (!slug || !selectedDate || !formData.service_id || !formData.professional_id) {
        setSlots([]);
        setFormData((prev) => ({ ...prev, scheduled_at: '' }));
        return;
      }
      try {
        setLoadingSlots(true);
        const result = await appointmentsService.listPublicAvailableSlots(slug, {
          date: selectedDate,
          service_id: formData.service_id,
          professional_id: formData.professional_id,
        });
        const slotList = Array.isArray(result?.slots) ? result.slots : [];
        setSlots(slotList);
        setFormData((prev) => ({
          ...prev,
          scheduled_at: slotList[0]?.scheduled_at || '',
        }));
      } catch (err: any) {
        setSlots([]);
        setFormData((prev) => ({ ...prev, scheduled_at: '' }));
        setError(err.message || 'Erro ao carregar horarios disponiveis');
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

  if (submitted) {
    const selectedService = services.find((item) => item.id === formData.service_id)?.name || 'servico';
    const selectedProfessional = professionals.find((item) => item.id === formData.professional_id)?.name || 'profissional';

    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle>Agendamento solicitado!</CardTitle>
            <CardDescription>
              Obrigado, {formData.customer_name}. Sua solicitacao para <strong>{selectedService}</strong> com <strong>{selectedProfessional}</strong> foi enviada para {companyName || 'a empresa'}.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <div className="w-full space-y-3">
              <Button className="w-full" onClick={() => window.location.reload()}>
                Fazer novo agendamento
              </Button>
              <p className="text-sm text-muted-foreground">
                <Link className="text-primary underline" to={`/cliente/${slug}/cadastro`}>
                  cliente se cadastre aqui
                </Link>
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#020b1f] p-3">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="space-y-1 bg-primary text-primary-foreground rounded-t-lg">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-6 w-6" />
            <CardTitle className="text-2xl">Agende seu horario</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80">
            {companyName ? `Empresa: ${companyName}` : 'Preencha os dados abaixo para solicitar seu agendamento.'}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="pt-5 space-y-3">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="name">Seu nome</Label>
              <Input
                id="name"
                placeholder="Ex: Joao Silva"
                required
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(00) 00000-0000"
                required
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              />
            </div>

            <hr className="my-4" />

            <div className="grid gap-2">
              <Label htmlFor="service">Servico desejado</Label>
              <select
                id="service"
                required
                value={formData.service_id}
                onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                disabled={loadingOptions || services.length === 0}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{loadingOptions ? 'Carregando servicos...' : 'Selecione um servico'}</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="professional">Profissional desejado</Label>
              <select
                id="professional"
                required
                value={formData.professional_id}
                onChange={(e) => setFormData({ ...formData, professional_id: e.target.value })}
                disabled={loadingOptions || professionals.length === 0}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{loadingOptions ? 'Carregando profissionais...' : 'Selecione um profissional'}</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                required
                min={minDate}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="slot">Horario disponivel</Label>
              <select
                id="slot"
                required
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                disabled={loadingSlots || slots.length === 0}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">
                  {loadingSlots ? 'Carregando horarios...' : slots.length ? 'Selecione um horario' : 'Sem horarios disponiveis'}
                </option>
                {slots.map((slot) => (
                  <option key={slot.scheduled_at} value={slot.scheduled_at}>
                    {slot.time}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Observacoes (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Alguma observacao sobre o atendimento?"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </CardContent>

          <CardFooter>
            <div className="w-full space-y-3">
              <Button
                type="submit"
                className="w-full"
                disabled={
                  loading ||
                  !!error ||
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
                <Link className="text-primary underline" to={`/cliente/${slug}/cadastro`}>
                  cliente se cadastre aqui
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
