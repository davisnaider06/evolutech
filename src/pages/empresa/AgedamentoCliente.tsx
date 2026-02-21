import React, { useState } from 'react';
import { useCompanyData } from '@/hooks/useCompanyData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CalendarCheck, CheckCircle2 } from 'lucide-react';

// Estrutura do registro de agendamento (retornado pela base)
interface Appointment {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  scheduled_at: string;
  status: string;
  notes: string;
}

// Payload enviado no create
interface AppointmentInput extends Record<string, unknown> {
  customer_name: string;
  customer_phone: string;
  service_name: string;
  scheduled_at: string;
  status: string;
  notes: string;
}

const AgendamentoCliente: React.FC = () => {
  // Estado para controlar se o agendamento foi finalizado com sucesso
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Hook para enviar os dados para a base de dados
  const { create } = useCompanyData<Appointment>('appointments');

  // Estado do formulário
  const [formData, setFormData] = useState<AppointmentInput>({
    customer_name: '',
    customer_phone: '',
    service_name: '',
    scheduled_at: '',
    status: 'pendente', // Todo agendamento de cliente começa como pendente
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await create(formData);
      setSubmitted(true);
    } catch (error) {
      console.error("Erro ao agendar:", error);
      alert("Erro ao realizar agendamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Se o cliente já agendou, mostra uma mensagem de sucesso
  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle>Agendamento Solicitado!</CardTitle>
            <CardDescription>
              Obrigado, {formData.customer_name}. O seu horário para o serviço de <strong>{formData.service_name}</strong> foi enviado.
              Aguarde o nosso contacto para confirmação.
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
            <CardTitle className="text-2xl">Agende o seu Horário</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80">
            Preencha os dados abaixo para solicitar uma reserva.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="pt-6 space-y-4">
            {/* Dados do Cliente */}
            <div className="grid gap-2">
              <Label htmlFor="name">Seu Nome Full</Label>
              <Input 
                id="name" 
                placeholder="Ex: João Silva" 
                required 
                value={formData.customer_name}
                onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Telemóvel / WhatsApp</Label>
              <Input 
                id="phone" 
                type="tel" 
                placeholder="(00) 00000-0000" 
                required 
                value={formData.customer_phone}
                onChange={(e) => setFormData({...formData, customer_phone: e.target.value})}
              />
            </div>

            <hr className="my-4" />

            {/* Dados do Serviço */}
            <div className="grid gap-2">
              <Label htmlFor="service">Serviço Desejado</Label>
              <Input 
                id="service" 
                placeholder="Ex: Corte de Cabelo, Consultoria, etc." 
                required 
                value={formData.service_name}
                onChange={(e) => setFormData({...formData, service_name: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="date">Data e Hora Preferencial</Label>
              <Input 
                id="date" 
                type="datetime-local" 
                required 
                value={formData.scheduled_at}
                onChange={(e) => setFormData({...formData, scheduled_at: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Observações (Opcional)</Label>
              <Textarea 
                id="notes" 
                placeholder="Alguma recomendação especial?" 
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit" className="w-full size-lg" disabled={loading}>
              {loading ? "A processar..." : "Confirmar Agendamento"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default AgendamentoCliente;
