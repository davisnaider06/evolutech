import React from 'react';
import { cn } from '@/lib/utils';

interface BotaoIconeCircularProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  rotulo: string;
}

/** Botao redondo branco de 44px com icone de traco fino (sino, tema etc.). */
export const BotaoIconeCircular = React.forwardRef<HTMLButtonElement, BotaoIconeCircularProps>(
  ({ rotulo, className, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-card outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-5 [&_svg]:w-5',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
BotaoIconeCircular.displayName = 'BotaoIconeCircular';
