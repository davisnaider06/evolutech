import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tendencia = 'alta' | 'queda' | 'neutra';

interface BadgeTendenciaProps {
  tendencia?: Tendencia;
  children: React.ReactNode;
  className?: string;
}

/**
 * Pilula pequena no canto do card: seta + texto. Verde suave para alta,
 * vermelho suave para queda, neutra sem seta. As cores sao as de status.
 */
export const BadgeTendencia: React.FC<BadgeTendenciaProps> = ({ tendencia = 'neutra', children, className }) => {
  const Seta = tendencia === 'alta' ? TrendingUp : tendencia === 'queda' ? TrendingDown : null;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-legenda font-medium',
        tendencia === 'alta' && 'bg-success/10 text-success-foreground',
        tendencia === 'queda' && 'bg-destructive/10 text-destructive',
        tendencia === 'neutra' && 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {Seta && <Seta className="h-3 w-3" strokeWidth={1.75} aria-hidden />}
      {children}
    </span>
  );
};
