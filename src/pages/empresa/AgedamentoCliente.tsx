import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  service_name: string;
  scheduled_at: string;
  notes: string;
}

const AgendamentoCliente: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<AppointmentInput>({
    customer_name: '',
    customer_phone: '',
    service_name: '',
    scheduled_at: '',
    notes: '',
  });

  useEffect(() => {
    const loadCompany = async () => {
      try {
        const company = await appointmentsService.getPublicBookingCompany(slug);
        setCompanyName(company.name);
      } catch (err: any) {
        setError(err.message || 'Link de agendamento invalido');
      }
    };

    if (slug) {
      loadCompany();
    } else {
      setError('Link de agendamento invalido');
    }
  }, [slug]);

  const minDateTime = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return now.toISOString().slice(0, 16);
  }, []);

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
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle>Agendamento solicitado!</CardTitle>
            <CardDescription>
              Obrigado, {formData.customer_name}. Sua solicitacao para <strong>{formData.service_name}</strong> foi enviada para {companyName || 'a empresa'}.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => window.location.reload()}>
              Fazer novo agendamento
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-lg shadow-lg">
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
          <CardContent className="pt-6 space-y-4">
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
              <Input
                id="service"
                placeholder="Ex: Corte + Barba"
                required
                value={formData.service_name}
                onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">Data e hora</Label>
              <Input
                id="date"
                type="datetime-local"
                required
                min={minDateTime}
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              />
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
            <Button type="submit" className="w-full" disabled={loading || !!error}>
              {loading ? 'Enviando...' : 'Confirmar agendamento'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default AgendamentoCliente;
