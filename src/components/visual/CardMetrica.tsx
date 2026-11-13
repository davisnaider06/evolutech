import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BadgeTendencia, type Tendencia } from './BadgeTendencia';

export type TomIcone = 'primary' | 'accent' | 'success' | 'info';

const COR_ICONE: Record<TomIcone, string> = {
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success',
  info: 'text-info',
};

interface CardMetricaProps {
  rotulo: string;
  valor: React.ReactNode;
  icone: LucideIcon;
  tom?: TomIcone;
  /** Texto do badge do canto. Sem ele, o badge nao aparece. */
  badge?: React.ReactNode;
  tendencia?: Tendencia;
  /** Linha pequena abaixo do valor, para contexto ("3 ainda por vir"). */
  detalhe?: React.ReactNode;
  carregando?: boolean;
  className?: string;
}

/**
 * Card de metrica: icone colorido e badge no topo, rotulo cinza e valor grande
 * embaixo. Branco, sem borda, raio grande.
 */
export const CardMetrica: React.FC<CardMetricaProps> = ({
  rotulo,
  valor,
  icone: Icone,
  tom = 'primary',
  badge,
  tendencia = 'neutra',
  detalhe,
  carregando = false,
  className,
}) => (
  <article className={cn('min-w-0 rounded-card bg-card p-card-pad text-card-foreground shadow-card', className)}>
    <div className="flex items-start justify-between gap-2">
      <Icone
        className={cn('h-6 w-6 shrink-0', COR_ICONE[tom])}
        style={{ fillOpacity: 0.18 }}
        fill="currentColor"
        strokeWidth={1.75}
        aria-hidden
      />
      {badge && !carregando && <BadgeTendencia tendencia={tendencia}>{badge}</BadgeTendencia>}
    </div>

    <p className="mt-6 truncate text-rotulo text-muted-foreground">{rotulo}</p>
    {carregando ? (
      <div role="status" aria-label={`Carregando ${rotulo}`} className="esqueleto-vidro mt-1.5 h-8 w-24 rounded-lg" />
    ) : (
      <p className="mt-0.5 truncate text-valor text-foreground sm:text-valor-lg">{valor}</p>
    )}
    {detalhe && !carregando && <p className="mt-1 truncate text-legenda text-muted-foreground">{detalhe}</p>}
  </article>
);
