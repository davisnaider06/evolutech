import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ArrowRight } from 'lucide-react';

const AcceptInvite: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="absolute inset-0 gradient-dark" />
      <div className="absolute left-1/4 top-1/4 h-96 w-96 gradient-glow opacity-60 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <Card className="glass border-border/60">
          <CardContent className="space-y-6 p-8 text-center">
            <div className="flex justify-center">
              <Logo size="lg" />
            </div>

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <AlertCircle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Convite legado desativado</h1>
              <p className="text-sm text-muted-foreground">
                Esse link de convite não é mais usado neste fluxo. Agora os acessos são criados
                diretamente no painel administrativo e o login é feito pela tela principal.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-4 text-left text-sm text-muted-foreground">
              Se você precisava acessar uma empresa:
              <br />
              1. peça para o administrador confirmar seu cadastro
              <br />
              2. depois entre pela tela de login normal
            </div>

            <Button className="w-full gap-2" onClick={() => navigate('/login')}>
              Ir para login
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AcceptInvite;
