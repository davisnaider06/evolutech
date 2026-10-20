import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { CalendarCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { customerPortalService } from '@/services/customer-portal';
import { esquecerAgendamentoPendente, lerAgendamentoPendente } from '@/lib/agendamento-pendente';
import { formatarDataHora } from '@/lib/horario';

/**
 * Ultimo passo do link do cliente: depois de entrar ou criar a conta, ele ve
 * so o resumo do que escolheu e confirma. O horario cai na agenda do barbeiro
 * e do dono como qualquer outro agendamento do portal.
 */
const ConfirmarAgendamento: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const slugNormalizado = slug.trim().toLowerCase();
  const navigate = useNavigate();
  const sessao = useCustomerAuth();
  // Lido uma vez: depois de confirmar o rascunho e apagado, e a tela de
  // sucesso ainda precisa mostrar o que foi marcado.
  const [pendente] = useState(() => lerAgendamentoPendente(slugNormalizado));
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState('');
  const [barbeiroEscolhido, setBarbeiroEscolhido] = useState('');

  if (sessao.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!sessao.isAuthenticated || sessao.company?.slug !== slugNormalizado) {
    return <Navigate to={`/cliente/${slugNormalizado}/login`} replace />;
  }
  if (!pendente) return <Navigate to={`/agendar/${slugNormalizado}`} replace />;

  const confirmar = async () => {
    setEnviando(true);
    setErro('');
    try {
      const criado = await customerPortalService.createAppointment({
        service_id: pendente.service_id,
        professional_id: pendente.professional_id,
        scheduled_at: pendente.scheduled_at,
      });
      // Com "qualquer barbeiro" e o backend que escolhe: mostra quem ficou.
      if (criado.professional_name) setBarbeiroEscolhido(criado.professional_name);
      esquecerAgendamentoPendente();
      setConfirmado(true);
    } catch (error: any) {
      // Horario pego por outro no meio do cadastro, mensalidade em aberto...
      // O rascunho fica: na volta, servico, barbeiro e dia ja vem escolhidos.
      setErro(error.message || 'Não foi possível marcar esse horário. Escolha outro.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-3">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mb-2 flex justify-center">
            {confirmado ? (
              <CheckCircle2 className="h-14 w-14 text-green-500" />
            ) : (
              <CalendarCheck className="h-14 w-14 text-primary" />
            )}
          </div>
          <CardTitle>{confirmado ? 'Horário marcado!' : 'Confirme seu agendamento'}</CardTitle>
          <p className="text-2xl font-bold">{formatarDataHora(pendente.scheduled_at)}</p>
          <CardDescription>
            <strong>{pendente.service_name || 'Serviço'}</strong> com{' '}
            <strong>{barbeiroEscolhido || pendente.professional_name || 'profissional'}</strong>
            {sessao.company?.name ? ` na ${sessao.company.name}` : ''}.
          </CardDescription>
          {erro && (
            <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </div>
          )}
        </CardHeader>
        <CardFooter>
          <div className="w-full space-y-3">
            {confirmado ? (
              <Button className="h-11 w-full" onClick={() => navigate('/cliente/dashboard', { replace: true })}>
                Ver meus horários
              </Button>
            ) : (
              <>
                <Button className="h-11 w-full" onClick={confirmar} disabled={enviando}>
                  {enviando ? 'Confirmando...' : 'Confirmar agendamento'}
                </Button>
                <Link className="block text-sm text-muted-foreground underline" to={`/agendar/${slugNormalizado}`}>
                  Trocar o horário
                </Link>
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ConfirmarAgendamento;
