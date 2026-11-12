import React from 'react';
import { LucideIcon, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardMetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  detail: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
}

export const DashboardMetricCard: React.FC<DashboardMetricCardProps> = ({
  title,
  value,
  icon: Icon,
  detail,
  trend = 'neutral',
  trendLabel,
}) => {
  const isDown = trend === 'down';

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-[1.45rem] border border-white/10 bg-card/90 p-4 shadow-card transition duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-elevated sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/15">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        {trendLabel && trend !== 'neutral' && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold sm:text-xs',
              isDown ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-500',
            )}
          >
            {isDown ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {trendLabel}
          </span>
        )}
      </div>

      <p className="mt-5 text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
      {value === '...' ? (
        <div role="status" aria-label={`Carregando ${title}`} className="esqueleto-vidro mt-2 h-8 w-24 rounded-lg" />
      ) : (
        <p className="mt-1 truncate text-2xl font-bold tracking-[-0.045em] text-foreground sm:text-3xl">{value}</p>
      )}
      <p className="mt-2 truncate text-[11px] text-muted-foreground sm:text-xs">{detail}</p>
    </article>
  );
};
