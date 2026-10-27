/**
 * Tela de escolha que abre antes de qualquer login.
 *
 * Existe porque o cliente da barbearia caia no formulario da equipe e tentava
 * entrar com a conta dele ali. O caminho do cliente e o botao dourado grande
 * (e a maioria de quem abre o app); a equipe entra pelo link de baixo, no
 * lugar do "Ja tem conta? Entrar" do prototipo. A escolha fica guardada para
 * nao repetir o passo em cada abertura do app.
 */
import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Loader2 } from 'lucide-react';
import { rotaEntradaCliente } from '@/services/customer-portal';
import { API_URL } from '@/config/api';
import { lembrarTipoAcesso, TipoAcesso } from '@/lib/tipo-acesso';
import { LogoMarca } from '@/components/Logo';
import {
  PontosFoto,
  TelaComFoto,
  TituloFoto,
  botaoFoto,
  linkFoto,
} from '@/components/telas/TelaComFoto';

// As mensagens que passam embaixo do titulo, como o carrossel do prototipo.
const MENSAGENS = [
  'Escolha o serviço, o barbeiro e o horário em poucos toques.',
  'Receba a confirmação e um lembrete antes do seu horário.',
  'Avalie o atendimento sem se identificar para o barbeiro.',
];

const EscolhaAcesso: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, getRedirectPath } = useAuth();
  const cliente = useCustomerAuth();
  const [mensagem, setMensagem] = useState(0);

  // Aquecer o backend aqui poupa a espera do cold start no primeiro login,
  // que antes era paga na tela de login.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`${API_URL}/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      }).catch(() => undefined);
    }, 50);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setMensagem((atual) => (atual + 1) % MENSAGENS.length), 4500);
    return () => window.clearInterval(timer);
  }, []);

  // Quem ja tem sessao viva nao escolhe nada: vai para o painel dele.
  if (isLoading || cliente.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to={getRedirectPath()} replace />;
  if (cliente.isAuthenticated) return <Navigate to="/cliente/dashboard" replace />;

  // Escolher ja e lembrar: quem errou volta pelo "nao e voce?" de cada login.
  const escolher = (tipo: TipoAcesso) => {
    lembrarTipoAcesso(tipo);
    navigate(tipo === 'cliente' ? rotaEntradaCliente() : '/login', { replace: true });
  };

  return (
    <TelaComFoto
      topo={
        <span className="flex items-center gap-2 text-sm font-semibold">
          <LogoMarca className="h-7 w-7" />
          iBarber
        </span>
      }
    >
      <TituloFoto linha="Seu horário na" destaque="Barbearia" descricao={MENSAGENS[mensagem]} />
      <PontosFoto total={MENSAGENS.length} ativo={mensagem} onEscolher={setMensagem} />

      <button type="button" onClick={() => escolher('cliente')} className={`${botaoFoto} mt-8`}>
        Sou cliente
      </button>

      <p className="mt-5 text-center text-sm text-white/80">
        Trabalha na barbearia?{' '}
        <button type="button" onClick={() => escolher('equipe')} className={linkFoto}>
          Entrar
        </button>
      </p>
    </TelaComFoto>
  );
};

export default EscolhaAcesso;
