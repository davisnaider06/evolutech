import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { customerAuthService, empresaDoCliente } from '@/services/customer-portal';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { CustomerPortalCompanyOption } from '@/types/customer-portal';

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
  const navigate = useNavigate();
  const sessao = useCustomerAuth();
  const { login } = sessao;
  const hasSlugFromRoute = useMemo(() => Boolean((slug || '').trim()), [slug]);
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
      navigate('/cliente/dashboard', { replace: true });
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
    return <Navigate to="/cliente/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          {selectedCompany?.logo_url ? (
            <div className="mb-2">
              <img
                src={selectedCompany.logo_url}
                alt={selectedCompany.name}
                className="h-12 w-auto max-w-[180px] object-contain"
              />
            </div>
          ) : null}
          <CardTitle>Portal do Cliente</CardTitle>
          <CardDescription>Entre para acompanhar seus agendamentos e beneficios.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="company_slug">Empresa</Label>
              <select
                id="company_slug"
                value={form.company_slug}
                onChange={(event) => setForm((old) => ({ ...old, company_slug: event.target.value }))}
                required
                disabled={loadingCompanies || hasSlugFromRoute}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">
                  {loadingCompanies ? 'Carregando empresas...' : 'Selecione sua empresa'}
                </option>
                {companies.map((company) => (
                  <option key={company.id} value={company.slug}>
                    {company.name}
                  </option>
                ))}
              </select>
              {hasSlugFromRoute && (
                <p className="text-xs text-muted-foreground">Empresa identificada automaticamente pelo link.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="identifier">Email ou telefone</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="cliente@email.com ou (11) 91234-5678"
                value={form.identifier}
                onChange={(event) => setForm((old) => ({ ...old, identifier: event.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Use o mesmo email ou telefone que voce informou no cadastro.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))}
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link
              className="text-primary underline"
              to={hasSlugFromRoute ? `/cliente/${form.company_slug}/cadastro` : '/cliente/cadastro'}
            >
              Cliente novo? Cadastre-se aqui!
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerLogin;
