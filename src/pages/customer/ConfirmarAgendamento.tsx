import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { TelaComFoto, TituloFoto, botaoFoto } from '@/components/telas/TelaComFoto';
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
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
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
    <TelaComFoto>
      {confirmado ? (
        <div className="mb-4 flex justify-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-400" />
        </div>
      ) : null}
      <TituloFoto
        linha={confirmado ? 'Pronto,' : 'Confirme seu'}
        destaque={confirmado ? 'Horário marcado!' : 'Horário'}
      />
      <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4 text-center backdrop-blur-md">
        <p className="text-xl font-bold">{formatarDataHora(pendente.scheduled_at)}</p>
        <p className="mt-1 text-sm text-white/80">
          {pendente.service_name || 'Serviço'} com {barbeiroEscolhido || pendente.professional_name || 'barbeiro'}
          {sessao.company?.name ? ` na ${sessao.company.name}` : ''}
        </p>
      </div>
      {erro && (
        <div className="mt-3 rounded-2xl border border-red-400/40 bg-red-500/20 px-4 py-3 text-sm text-white">
          {erro}
        </div>
      )}
      {confirmado ? (
        <button
          type="button"
          className={`${botaoFoto} mt-6`}
          onClick={() => navigate('/cliente/dashboard', { replace: true })}
        >
          Ver meus horários
        </button>
      ) : (
        <>
          <button type="button" className={`${botaoFoto} mt-6`} onClick={confirmar} disabled={enviando}>
            {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {enviando ? 'Confirmando...' : 'Confirmar agendamento'}
          </button>
          <Link className="mt-4 text-center text-sm text-white/70 underline" to={`/agendar/${slugNormalizado}`}>
            Trocar o horário
          </Link>
        </>
      )}
    </TelaComFoto>
  );
};

export default ConfirmarAgendamento;
