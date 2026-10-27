import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { LogoMarca } from '@/components/Logo';
import {
  TelaComFoto,
  TituloFoto,
  botaoFoto,
  campoFoto,
  linkFoto,
  rotuloFoto,
} from '@/components/telas/TelaComFoto';
import { customerAuthService, empresaDoCliente } from '@/services/customer-portal';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { CustomerPortalCompanyOption } from '@/types/customer-portal';
import { lembrarTipoAcesso } from '@/lib/tipo-acesso';
import { lerAgendamentoPendente } from '@/lib/agendamento-pendente';
import { formatarDiaHora } from '@/lib/horario';

const CustomerLogin: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [form, setForm] = useState({
    company_slug: '',
    // Um campo so para os dois identificadores: quem se cadastrou com email
    // digita o email, quem se cadastrou com telefone digita o telefone. Quem
    // decide qual e o backend, que ja normaliza o numero antes de procurar.
    identifier: '',
    password: '',
  });
  const [companies, setCompanies] = useState<CustomerPortalCompanyOption[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loading, setLoading] = useState(false);
  const [verSenha, setVerSenha] = useState(false);
  const navigate = useNavigate();
  const sessao = useCustomerAuth();
  const { login } = sessao;
  const hasSlugFromRoute = useMemo(() => Boolean((slug || '').trim()), [slug]);
  // Horario escolhido no link publico, esperando o login para ser marcado.
  const pendente = useMemo(() => (slug ? lerAgendamentoPendente(slug) : null), [slug]);
  const selectedCompany = useMemo(
    () => companies.find((item) => item.slug === form.company_slug) || null,
    [companies, form.company_slug]
  );

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setLoadingCompanies(true);
        const data = await customerAuthService.listCompanies();
        setCompanies(data || []);
      } catch (error: any) {
        toast.error(error.message || 'Erro ao carregar empresas');
      } finally {
        setLoadingCompanies(false);
      }
    };
    loadCompanies();
  }, []);

  useEffect(() => {
    if (hasSlugFromRoute) {
      setForm((old) => ({ ...old, company_slug: String(slug).trim().toLowerCase() }));
      return;
    }
    // Sem empresa no link, sugere a do ultimo cliente deste aparelho — ainda
    // da para trocar no seletor.
    const lembrada = empresaDoCliente();
    if (lembrada) setForm((old) => (old.company_slug ? old : { ...old, company_slug: lembrada }));
  }, [hasSlugFromRoute, slug]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await customerAuthService.login(form);
      login(result.token, result.customer, result.company);
      toast.success(`Bem-vindo(a), ${result.customer.name}`);
      // Veio do link de agendamento: falta so confirmar o horario escolhido.
      navigate(
        lerAgendamentoPendente(result.company?.slug)
          ? `/agendar/${result.company.slug}/confirmar`
          : '/cliente/dashboard',
        { replace: true }
      );
    } catch (error: any) {
      toast.error(error.message || 'Falha ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  // Quem ja esta logado nao ve o formulario: o link que a barbearia mandou e
  // o atalho salvo apontam para esta tela, e cair nela a cada abertura era a
  // queixa de "pede login toda hora". Link de outra barbearia continua
  // mostrando o login dela.
  if (sessao.isLoading) return null;
  if (
    sessao.isAuthenticated &&
    (!hasSlugFromRoute || sessao.company?.slug === String(slug).trim().toLowerCase())
  ) {
    return (
      <Navigate
        to={pendente && sessao.company?.slug ? `/agendar/${sessao.company.slug}/confirmar` : '/cliente/dashboard'}
        replace
      />
    );
  }

  const nomeBarbearia = selectedCompany?.name || '';

  return (
    <TelaComFoto
      topo={
        selectedCompany?.logo_url ? (
          <img
            src={selectedCompany.logo_url}
            alt={selectedCompany.name}
            className="h-10 w-auto max-w-[160px] rounded-md object-contain"
          />
        ) : (
          <span className="flex items-center gap-2 text-sm font-semibold">
            <LogoMarca className="h-7 w-7" />
            iBarber
          </span>
        )
      }
    >
      {/* Com a empresa no link, o cliente ve o nome da barbearia dele no
          titulo — e nao um seletor de "Empresa" que ele nao precisa mexer. */}
      <TituloFoto
        linha={hasSlugFromRoute && nomeBarbearia ? 'Entrar na' : 'Entrar na sua'}
        destaque={hasSlugFromRoute && nomeBarbearia ? nomeBarbearia : 'Barbearia'}
        descricao={
          pendente
            ? `Seu horário de ${formatarDiaHora(pendente.scheduled_at)} está guardado. Entre para confirmar.`
            : 'Veja seus horários, avalie o atendimento e marque o próximo corte.'
        }
      />

      <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
        {!hasSlugFromRoute && (
          <div>
            <label htmlFor="company_slug" className={rotuloFoto}>Barbearia</label>
            <select
              id="company_slug"
              value={form.company_slug}
              onChange={(event) => setForm((old) => ({ ...old, company_slug: event.target.value }))}
              required
              disabled={loadingCompanies}
              className={`${campoFoto} appearance-none [&>option]:text-neutral-900`}
            >
              <option value="">
                {loadingCompanies ? 'Carregando...' : 'Onde você é cliente?'}
              </option>
              {companies.map((company) => (
                <option key={company.id} value={company.slug}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="identifier" className={rotuloFoto}>WhatsApp ou e-mail</label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            placeholder="(11) 91234-5678"
            className={campoFoto}
            value={form.identifier}
            onChange={(event) => setForm((old) => ({ ...old, identifier: event.target.value }))}
            required
          />
        </div>
        <div>
          <label htmlFor="password" className={rotuloFoto}>Senha</label>
          <div className="relative">
            <input
              id="password"
              type={verSenha ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Sua senha"
              className={`${campoFoto} pr-12`}
              value={form.password}
              onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))}
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
          {/* O link sai por e-mail; quem cadastrou so WhatsApp pede o link
              a barbearia, que o gera na tela de Clientes. */}
          {form.company_slug ? (
            <Link
              to={`/cliente/${form.company_slug}/esqueci-senha`}
              className="mt-2 inline-block pl-4 text-xs text-white/70 hover:underline"
            >
              Esqueci minha senha
            </Link>
          ) : null}
        </div>
        <button className={`${botaoFoto} mt-2`} type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/80">
        Primeira vez?{' '}
        <Link
          className={linkFoto}
          to={hasSlugFromRoute ? `/cliente/${form.company_slug}/cadastro` : '/cliente/cadastro'}
        >
          Criar conta
        </Link>
      </p>

      {/* Saida para o dono ou barbeiro que abriu o link da propria barbearia. */}
      <p className="mt-3 text-center text-xs text-white/50">
        <Link className="hover:underline" to="/login" onClick={() => lembrarTipoAcesso('equipe')}>
          Sou da equipe
        </Link>
      </p>
    </TelaComFoto>
  );
};

export default CustomerLogin;
