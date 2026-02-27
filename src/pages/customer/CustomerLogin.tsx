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

const CustomerLogin: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [form, setForm] = useState({
    company_slug: '',
    email: '',
    password: '',
  });
  const [companies, setCompanies] = useState<CustomerPortalCompanyOption[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useCustomerAuth();
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Portal do Cliente</CardTitle>
          <CardDescription>Entre para acompanhar seus agendamentos e benefícios.</CardDescription>
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="cliente@email.com"
                value={form.email}
                onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))}
                required
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
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link
              className="text-primary underline"
              to={hasSlugFromRoute ? `/cliente/${form.company_slug}/cadastro` : '/cliente/cadastro'}
            >
              cliente se cadastre aqui
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerLogin;
