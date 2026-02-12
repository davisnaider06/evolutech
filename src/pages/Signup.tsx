import React from 'react';
import { SignUp } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { Logo } from '@/components/Logo';

const Signup: React.FC = () => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* --- EFEITOS DE FUNDO (IDÊNTICOS AO LOGIN) --- */}
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

      {/* --- CARD DE CADASTRO --- */}
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="glass rounded-2xl p-8 shadow-elevated flex flex-col items-center">
          
          <div className="mb-6 flex justify-center">
            <Logo size="lg" />
          </div>

          <SignUp 
            appearance={{
              baseTheme: dark,
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none w-full p-0", // Remove fundo padrão
                headerTitle: "text-foreground text-xl font-bold",
                headerSubtitle: "text-muted-foreground",
                formFieldLabel: "text-foreground",
                formFieldInput: "bg-background/50 border-input text-foreground",
                footerActionText: "text-muted-foreground",
                footerActionLink: "text-primary hover:text-primary/90"
              }
            }}
            routing="path" 
            path="/cadastro" 
            signInUrl="/login" // Link para voltar ao login
            forceRedirectUrl="/redirect" // Para onde vai após criar a conta
          />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Evolutech Digital. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Signup;