import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { customerAuthService } from '@/services/customer-portal';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';

const CustomerLogin: React.FC = () => {
  const [form, setForm] = useState({
    company_slug: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useCustomerAuth();

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
              <Label htmlFor="company_slug">Slug da empresa</Label>
              <Input
                id="company_slug"
                placeholder="minha-empresa"
                value={form.company_slug}
                onChange={(event) => setForm((old) => ({ ...old, company_slug: event.target.value }))}
                required
              />
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
            Ainda nao tem conta? <Link className="text-primary underline" to="/cliente/cadastro">Criar conta</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerLogin;
