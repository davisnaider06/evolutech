import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle, User } from 'lucide-react';
import { z } from 'zod';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
});

interface InviteData {
  id: string;
  email: string;
  role: string;
  company_id: string | null;
  company_name?: string;
}

const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        toast.error('Token de convite inválido');
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('invitations')
        .select('id, email, role, company_id, companies(name)')
        .eq('token', token)
        .eq('status', 'pending')
        .maybeSingle();

      if (error || !data) {
        toast.error('Convite inválido ou expirado');
        navigate('/login');
        return;
      }

      // Check if expired
      const { data: fullInvite } = await supabase
        .from('invitations')
        .select('expires_at')
        .eq('id', data.id)
        .single();

      if (fullInvite && new Date(fullInvite.expires_at) < new Date()) {
        toast.error('Este convite expirou');
        navigate('/login');
        return;
      }

      const company = data.companies as { name: string } | null;
      setInviteData({
        id: data.id,
        email: data.email,
        role: data.role,
        company_id: data.company_id,
        company_name: company?.name,
      });
      setIsLoading(false);
    };

    fetchInvite();
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = schema.safeParse({ fullName, password, confirmPassword });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    if (!inviteData || !token) return;

    setIsSubmitting(true);
    try {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteData.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: fullName },
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Erro ao criar usuário');
      }

      // Assign role to the user
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: inviteData.role as any,
          company_id: inviteData.company_id,
        });

      if (roleError) {
        console.error('Error assigning role:', roleError);
        // Continue anyway, the user is created
      }

      // Update invitation status to active
      await supabase
        .from('invitations')
        .update({ status: 'active' })
        .eq('id', inviteData.id);

      // Auto-login the user
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: inviteData.email,
        password,
      });

      if (loginError) {
        // If login fails, show success and redirect to login
        setIsComplete(true);
        toast.success('Conta criada com sucesso!');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }
      
      // Login successful, redirect based on role
      toast.success('Conta criada com sucesso! Redirecionando...');
      
      // Determine redirect path based on role
      const redirectPath = inviteData.role === 'dono_empresa' 
        ? '/empresa/dashboard' 
        : '/empresa/app';
      
      setTimeout(() => navigate(redirectPath), 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao criar conta';
      if (message.includes('already registered')) {
        toast.error('Este email já está cadastrado. Faça login.');
        navigate('/login');
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
        <div className="absolute inset-0 gradient-dark" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 gradient-glow opacity-60 blur-3xl" />
        
        <div className="relative z-10 w-full max-w-md animate-slide-up">
          <div className="glass rounded-2xl p-8 shadow-elevated text-center">
            <div className="mb-6 flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Conta criada!</h1>
            <p className="text-muted-foreground mb-6">
              Sua conta foi criada com sucesso. Você será redirecionado para o login.
            </p>
            <Button variant="glow" onClick={() => navigate('/login')}>
              Ir para login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute inset-0 gradient-dark" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 gradient-glow opacity-60 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="glass rounded-2xl p-8 shadow-elevated">
          <div className="mb-8 text-center">
            <div className="mb-6 flex justify-center">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-bold">Bem-vindo!</h1>
            <p className="mt-2 text-muted-foreground">
              Complete seu cadastro para acessar o sistema
            </p>
            {inviteData?.company_name && (
              <div className="mt-4 rounded-lg bg-secondary/50 px-4 py-2 text-sm">
                Você foi convidado para: <span className="font-semibold">{inviteData.company_name}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={inviteData?.email || ''}
                disabled
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Seu nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="glow"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Criando conta...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Criar conta</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Já tem uma conta?</span>{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-primary hover:underline font-medium"
            >
              Fazer login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;
