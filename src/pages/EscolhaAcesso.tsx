/**
 * Tela de escolha que abre antes de qualquer login.
 *
 * Existe porque o cliente da barbearia caia no formulario da equipe e tentava
 * entrar com a conta dele ali. Aqui ele ve, em dois cartoes do mesmo tamanho,
 * qual porta e a dele — e a escolha fica guardada para nao repetir o passo em
 * cada abertura do app.
 */
import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Logo } from '@/components/Logo';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ArrowRight, Building2, CalendarCheck, Loader2, User } from 'lucide-react';
import { rotaLoginCliente } from '@/services/customer-portal';
import { API_URL } from '@/config/api';
import { lembrarTipoAcesso, TipoAcesso } from '@/lib/tipo-acesso';

const EscolhaAcesso: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, getRedirectPath } = useAuth();
  const cliente = useCustomerAuth();
  const [lembrar, setLembrar] = useState(true);

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

  // Quem ja tem sessao viva nao escolhe nada: vai para o painel dele.
  if (isLoading || cliente.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to={getRedirectPath()} replace />;
  if (cliente.isAuthenticated) return <Navigate to="/cliente/dashboard" replace />;

  const escolher = (tipo: TipoAcesso) => {
    if (lembrar) lembrarTipoAcesso(tipo);
    navigate(tipo === 'cliente' ? rotaLoginCliente() : '/login', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Mesmo fundo do login para a troca de tela nao parecer outro sistema */}
      <div className="absolute inset-0 gradient-dark" />
      <div className="absolute top-1/4 left-1/4 h-96 w-96 gradient-glow opacity-60 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="animate-slide-up relative z-10 w-full max-w-md">
        <div className="glass flex flex-col items-center rounded-2xl p-8 shadow-elevated">
          <div className="mb-6 flex justify-center">
            <Logo size="lg" />
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">Como voce quer entrar?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Escolha a opcao que combina com voce para ir ao lugar certo.
            </p>
          </div>

          <div className="w-full space-y-3">
            <button
              type="button"
              onClick={() => escolher('cliente')}
              className="group flex w-full items-center gap-4 rounded-xl border border-input bg-background/50 p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">Sou Cliente</span>
                <span className="block text-xs text-muted-foreground">
                  Agendar horario, ver historico e meus beneficios
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </button>

            <button
              type="button"
              onClick={() => escolher('equipe')}
              className="group flex w-full items-center gap-4 rounded-xl border border-input bg-background/50 p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">Sou da Equipe</span>
                <span className="block text-xs text-muted-foreground">
                  Dono ou funcionario — painel da empresa
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </button>
          </div>

          <div className="mt-6 flex w-full items-center gap-2">
            <Checkbox
              id="lembrar-tipo-acesso"
              checked={lembrar}
              onCheckedChange={(valor) => setLembrar(valor === true)}
            />
            <Label htmlFor="lembrar-tipo-acesso" className="text-sm font-normal text-muted-foreground">
              Lembrar minha escolha neste aparelho
            </Label>
          </div>

          <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
            <CalendarCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Primeira vez como cliente? Escolha <strong>Sou Cliente</strong> — a proxima tela tem o
              cadastro.
            </span>
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Evolutech Digital. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default EscolhaAcesso;
