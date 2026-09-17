import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Mail, ArrowRight, Loader2, User } from 'lucide-react';
import { API_URL } from '@/config/api';
import { rotaLoginCliente } from '@/services/customer-portal';
import { esquecerTipoAcesso, lembrarTipoAcesso } from '@/lib/tipo-acesso';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, isLoading: verificandoSessao, getRedirectPath } = useAuth();
  const navigate = useNavigate();

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

  // Quem ja tem sessao valida nunca deve ver o formulario. Enquanto o
  // AuthProvider confere o token guardado nao da para decidir: mostrar o
  // formulario aqui e o que fazia o usuario logar de novo por cima de uma
  // sessao que estava viva.
  if (verificandoSessao) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={getRedirectPath()} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Bate no nosso backend local na nova rota de auth
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha no login');
      }

      // Sucesso! Salva no contexto e redireciona
      login(data.token, data.user, data.company);
      toast.success(`Bem-vindo, ${data.user.name}!`);

      if (data.user.role === 'SUPER_ADMIN_EVOLUTECH') {
          navigate('/admin-evolutech', { replace: true });
      } else if (data.user.role === 'DONO_EMPRESA') {
          navigate('/empresa/dashboard', { replace: true });
      } else {
          navigate('/redirect', { replace: true });
      }

    } catch (error: any) {
      toast.error(error.message || "Erro ao conectar com o servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* --- EFEITOS DE FUNDO (Preservados do seu design original) --- */}
      <div className="absolute inset-0 gradient-dark" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 gradient-glow opacity-60 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* --- CARD DE LOGIN --- */}
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Mantivemos a classe 'glass' e o padding para preservar o visual do card */}
        <div className="glass rounded-2xl p-8 shadow-elevated flex flex-col items-center">
          
          {/* Logo Centralizada */}
          <div className="mb-6 flex justify-center">
            <Logo size="lg" />
          </div>

          {/* O titulo diz de quem e esta tela: o cliente que cair aqui por
              engano percebe pelo cabecalho, nao so pelo link do rodape. */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground">Acesso da Equipe</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Dono e funcionarios — painel da empresa
            </p>
          </div>

          {/* Formulário Próprio (Substituindo o Clerk) */}
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="email"
                        type="email" 
                        placeholder="davisnaider06@gmail.com" 
                        className="pl-10 bg-background/50 border-input"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                </div>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="password"
                        type="password" 
                        placeholder="••••••••" 
                        className="pl-10 bg-background/50 border-input"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                </div>
            </div>

            <Button type="submit" className="w-full mt-6" disabled={isLoading} variant="glow">
                {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <ArrowRight className="mr-2 h-4 w-4" />}
                {isLoading ? 'Autenticando...' : 'Entrar'}
            </Button>

          </form>

          {/* Saida para o cliente que errou a porta. Era um link de texto solto
              e passava batido; agora e um bloco separado do formulario, e o
              clique ja grava a escolha para nao repetir o erro amanha. */}
          <div className="mt-8 w-full">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Nao e da equipe?
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Link
              to={rotaLoginCliente()}
              onClick={() => lembrarTipoAcesso('cliente')}
              className="group mt-4 flex w-full items-center gap-4 rounded-xl border border-input bg-background/50 p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">Sou cliente da empresa</span>
                <span className="block text-xs text-muted-foreground">
                  Entrar ou criar conta no Portal do Cliente
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              <Link className="hover:underline" to="/entrar" onClick={esquecerTipoAcesso}>
                Ver as opcoes de acesso novamente
              </Link>
            </p>
          </div>


        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Evolutech Digital. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;
