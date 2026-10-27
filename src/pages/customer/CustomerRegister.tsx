import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import { customerAuthService } from '@/services/customer-portal';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { CustomerPortalCompanyOption } from '@/types/customer-portal';
import { lerAgendamentoPendente } from '@/lib/agendamento-pendente';
import { formatarDiaHora } from '@/lib/horario';

const CustomerRegister: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [form, setForm] = useState({
    company_slug: '',
    full_name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [companies, setCompanies] = useState<CustomerPortalCompanyOption[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loading, setLoading] = useState(false);
  // "Confirmar senha" saiu: no celular a pessoa errava uma das duas e nao
  // entendia o aviso. O olho para ver a senha resolve o mesmo problema.
  const [verSenha, setVerSenha] = useState(false);
  const [mostrarEmail, setMostrarEmail] = useState(false);
  const { login } = useCustomerAuth();
  const navigate = useNavigate();
  const hasSlugFromRoute = useMemo(() => Boolean((slug || '').trim()), [slug]);
  // Horario escolhido no link publico, esperando o cadastro para ser marcado.
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
    }
  }, [hasSlugFromRoute, slug]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Email ou telefone: e o identificador que vai amarrar assinatura,
    // agendamento e fidelidade a esta pessoa, e sem ele nao ha como o cliente
    // reencontrar a propria conta depois. O backend recusa do mesmo jeito;
    // conferir aqui so evita a viagem.
    // Na barbearia tudo passa pelo WhatsApp (confirmacao, lembrete,
    // cobranca), e a conta ja usa o telefone como chave. O e-mail fica
    // opcional; o "um dos dois" confundia quem preenchia.
    if (!form.phone.trim()) {
      toast.error('Informe seu WhatsApp: é por ele que você entra e recebe os lembretes');
      return;
    }

    setLoading(true);
    try {
      const result = await customerAuthService.register({
        company_slug: form.company_slug,
        full_name: form.full_name,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      login(result.token, result.customer, result.company);
      toast.success('Cadastro concluído!');
      // Veio do link de agendamento: falta so confirmar o horario escolhido.
      navigate(
        lerAgendamentoPendente(result.company?.slug)
          ? `/agendar/${result.company.slug}/confirmar`
          : '/cliente/dashboard',
        { replace: true }
      );
    } catch (error: any) {
      toast.error(error.message || 'Falha ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  const nomeBarbearia = hasSlugFromRoute ? selectedCompany?.name || '' : '';

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
      <TituloFoto
        linha={nomeBarbearia ? 'Criar conta na' : 'Criar sua'}
        destaque={nomeBarbearia || 'Conta'}
        descricao={
          pendente
            ? `Falta pouco: crie a conta para confirmar ${formatarDiaHora(pendente.scheduled_at)}.`
            : 'Só nome, WhatsApp e uma senha. Leva menos de um minuto.'
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
          <label htmlFor="full_name" className={rotuloFoto}>Seu nome</label>
          <input
            id="full_name"
            autoComplete="name"
            placeholder="Como o barbeiro te chama"
            className={campoFoto}
            value={form.full_name}
            onChange={(event) => setForm((old) => ({ ...old, full_name: event.target.value }))}
            required
          />
        </div>
        <div>
          <label htmlFor="phone" className={rotuloFoto}>WhatsApp</label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 91234-5678"
            className={campoFoto}
            value={form.phone}
            onChange={(event) => setForm((old) => ({ ...old, phone: event.target.value }))}
            required
          />
          <p className="mt-1.5 pl-4 text-xs text-white/60">É com ele que você entra e recebe os lembretes.</p>
        </div>
        <div>
          <label htmlFor="password" className={rotuloFoto}>Crie uma senha</label>
          <div className="relative">
            <input
              id="password"
              type={verSenha ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Mínimo de 6 caracteres"
              minLength={6}
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
        </div>
        {/* E-mail so serve para recuperar a senha sozinho; fica escondido
            para nao parecer obrigatorio a quem so tem WhatsApp. */}
        {mostrarEmail ? (
          <div>
            <label htmlFor="email" className={rotuloFoto}>E-mail (opcional)</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@email.com"
              className={campoFoto}
              value={form.email}
              onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarEmail(true)}
            className="pl-4 text-xs text-white/70 underline"
          >
            Adicionar e-mail para recuperar a senha (opcional)
          </button>
        )}
        <button className={`${botaoFoto} mt-2`} type="submit" disabled={loading}>
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/80">
        Já tem conta?{' '}
        <Link
          className={linkFoto}
          to={hasSlugFromRoute ? `/cliente/${form.company_slug}/login` : '/cliente/login'}
        >
          Entrar
        </Link>
      </p>
    </TelaComFoto>
  );
};

export default CustomerRegister;
