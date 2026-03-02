import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { customerAuthService } from '@/services/customer-portal';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { CustomerPortalCompanyOption } from '@/types/customer-portal';

const CustomerRegister: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [form, setForm] = useState({
    company_slug: '',
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [companies, setCompanies] = useState<CustomerPortalCompanyOption[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login } = useCustomerAuth();
  const navigate = useNavigate();
  const hasSlugFromRoute = useMemo(() => Boolean((slug || '').trim()), [slug]);

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
    if (form.password !== form.confirmPassword) {
      toast.error('As senhas nao conferem');
      return;
    }

    setLoading(true);
    try {
      const result = await customerAuthService.register({
        company_slug: form.company_slug,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      });
      login(result.token, result.customer, result.company);
      toast.success('Cadastro concluido com sucesso');
      navigate('/cliente/dashboard', { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Falha ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Criar conta no Portal do Cliente</CardTitle>
          <CardDescription>Selecione sua empresa e conclua seu cadastro.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-2 md:col-span-2">
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="full_name">Nome completo</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(event) => setForm((old) => ({ ...old, full_name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(event) => setForm((old) => ({ ...old, phone: event.target.value }))}
              />
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
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setForm((old) => ({ ...old, confirmPassword: event.target.value }))}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? 'Cadastrando...' : 'Criar conta'}
              </Button>
            </div>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Ja possui conta?{' '}
            <Link
              className="text-primary underline"
              to={hasSlugFromRoute ? `/cliente/${form.company_slug}/login` : '/cliente/login'}
            >
              Fazer login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerRegister;
