import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogoMarca } from '@/components/Logo';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  TelaComFoto,
  TituloFoto,
  botaoFoto,
  campoFoto,
  rotuloFoto,
} from '@/components/telas/TelaComFoto';
import { API_URL } from '@/config/api';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verSenha, setVerSenha] = useState(false);
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
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
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

      // Destino decidido antes do login(): assim que a sessao entra no
      // contexto, esta tela se redireciona sozinha (getRedirectPath) — e com
      // a lista de modulos ainda vazia o barbeiro caia em "Minhas tarefas".
      let destino = '/redirect';
      if (data.user.role === 'SUPER_ADMIN_EVOLUTECH') {
        destino = '/admin-evolutech';
      } else if (data.user.role === 'DONO_EMPRESA') {
        destino = '/empresa/dashboard';
      } else if (data.user.role === 'FUNCIONARIO_EMPRESA') {
        // O barbeiro abre o sistema para ver quem atende agora: vai direto
        // para a agenda quando tem o modulo. O login devolve os modulos vazios
        // (para responder rapido); a lista vem do /auth/me, ja aquecido.
        let modulos: Array<{ codigo?: string }> = data.user?.modules?.length
          ? data.user.modules
          : data.company?.modules || [];
        if (modulos.length === 0) {
          const me = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${data.token}` },
          })
            .then((resposta) => (resposta.ok ? resposta.json() : null))
            .catch(() => null);
          modulos = me?.user?.modules || me?.company?.modules || [];
        }
        const temAgenda = modulos.some((modulo) =>
          ['appointments', 'agendamentos'].includes(String(modulo?.codigo || '').toLowerCase())
        );
        destino = temAgenda ? '/empresa/agendamentos' : '/empresa/app';
      }

      login(data.token, data.user, data.company);
      toast.success(`Bem-vindo, ${data.user.name}!`);
      navigate(destino, { replace: true });

    } catch (error: any) {
      toast.error(error.message || "Erro ao conectar com o servidor");
    } finally {
      setIsLoading(false);
    }
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
      {/* O titulo diz de quem e esta tela: o cliente que cair aqui por
          engano percebe pelo cabecalho, nao so pelo link do rodape. */}
      <TituloFoto linha="Acesso da" destaque="Equipe" descricao="Dono e barbeiros: agenda, caixa e comissões." />

      <form onSubmit={handleSubmit} className="mt-8 w-full space-y-4">
        <div>
          <label htmlFor="email" className={rotuloFoto}>E-mail</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            placeholder="voce@suabarbearia.com"
            autoComplete="email"
            className={campoFoto}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className={rotuloFoto}>Senha</label>
          <div className="relative">
            <input
              id="password"
              type={verSenha ? 'text' : 'password'}
              placeholder="Sua senha"
              autoComplete="current-password"
              className={`${campoFoto} pr-12`}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setVerSenha((atual) => !atual)}
              aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
            >
              {verSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <Link to="/esqueci-senha" className="mt-2 inline-block pl-4 text-xs text-white/70 hover:underline">
            Esqueci minha senha
          </Link>
        </div>

        <button type="submit" className={`${botaoFoto} mt-2`} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      {/* O cliente agenda pelo link da barbearia dele; esta tela nao sabe
          qual e, entao so explica onde ele esta. */}
      <p className="mt-5 text-center text-xs text-white/60">
        É cliente? Agende pelo link que a sua barbearia divulga no Instagram ou no WhatsApp.
      </p>
    </TelaComFoto>
  );
};

export default Login;
