import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { SignIn } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';

const Login: React.FC = () => {
  const { isAuthenticated, getRedirectPath } = useAuth();
  const navigate = useNavigate();

  // Se o usuário já estiver logado, redireciona automaticamente
  useEffect(() => {
    if (isAuthenticated) {
      const redirectPath = getRedirectPath();
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, getRedirectPath, navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* --- EFEITOS DE FUNDO (Preservados do seu design original) --- */}
      <div className="absolute inset-0 gradient-dark" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 gradient-glow opacity-60 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* --- CARD DE LOGIN --- */}
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Mantivemos a classe 'glass' e o padding para preservar o visual do card */}
        <div className="glass rounded-2xl p-8 shadow-elevated flex flex-col items-center">
          
          {/* Logo Centralizada */}
          <div className="mb-6 flex justify-center">
            <Logo size="lg" />
          </div>

          {/* Componente do Clerk
              Configurado para remover o card padrão do Clerk e usar o tema Dark 
          */}
          <SignIn 
            appearance={{
              baseTheme: dark,
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none w-full p-0", // Remove o fundo/sombra do Clerk para usar o seu Glass
                headerTitle: "text-foreground text-xl font-bold", // Ajusta tipografia
                headerSubtitle: "text-muted-foreground",
                formFieldLabel: "text-foreground",
                formFieldInput: "bg-background/50 border-input text-foreground", // Inputs mais integrados
                footerActionText: "text-muted-foreground",
                footerActionLink: "text-primary hover:text-primary/90"
              }
            }}
            routing="path" 
            path="/login" 
            signUpUrl="/cadastro" 
            forceRedirectUrl="/redirect"
          />
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Evolutech Digital. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;