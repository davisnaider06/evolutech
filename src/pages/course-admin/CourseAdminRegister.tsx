import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { courseAdminAuthService } from '@/services/course-admin';
import { useCourseAdminAuth } from '@/contexts/CourseAdminAuthContext';
import { CourseAdminCompany } from '@/types/course-admin';

const CourseAdminRegister: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [form, setForm] = useState({
    company_slug: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [companies, setCompanies] = useState<CourseAdminCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useCourseAdminAuth();
  const hasSlugFromRoute = useMemo(() => Boolean((slug || '').trim()), [slug]);
  const selectedCompany = useMemo(
    () => companies.find((item) => item.slug === form.company_slug) || null,
    [companies, form.company_slug]
  );

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setLoadingCompanies(true);
        const data = await courseAdminAuthService.listCompanies();
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
      const result = await courseAdminAuthService.register({
        company_slug: form.company_slug,
        email: form.email,
        password: form.password,
      });
      login(result.token, result.manager, result.company);
      toast.success('Conta de cursos criada com sucesso');
      navigate('/cursos/dashboard', { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Falha ao cadastrar conta de cursos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          {selectedCompany?.logo_url ? (
            <div className="mb-2">
              <img
                src={selectedCompany.logo_url}
                alt={selectedCompany.name}
                className="h-12 w-auto max-w-[200px] object-contain"
              />
            </div>
          ) : null}
          <CardTitle>Criar conta do Portal de Cursos</CardTitle>
          <CardDescription>Use o mesmo email do dono da empresa para vincular esta conta separada.</CardDescription>
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
                <option value="">{loadingCompanies ? 'Carregando empresas...' : 'Selecione sua empresa'}</option>
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
              <Label htmlFor="email">Email do dono</Label>
              <Input
                id="email"
                type="email"
                placeholder="dono@empresa.com"
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
                {loading ? 'Criando conta...' : 'Criar conta'}
              </Button>
            </div>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Ja possui conta?{' '}
            <Link
              className="text-primary underline"
              to={hasSlugFromRoute ? `/cursos/${form.company_slug}/login` : '/cursos/login'}
            >
              Fazer login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourseAdminRegister;
