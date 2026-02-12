import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    label: string;
  };
  icon: LucideIcon;
  iconColor?: string;
  className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  iconColor = 'text-primary',
  className,
}) => {
  const isPositive = change && change.value >= 0;

  return (
    <div className={cn(
      'group relative overflow-hidden rounded-xl glass p-6 transition-all duration-300 hover:shadow-elevated hover:border-primary/30',
      className
    )}>
      {/* Background glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 gradient-glow" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
            {change && (
              <div className="mt-2 flex items-center gap-1">
                <span className={cn(
                  'text-sm font-medium',
                  isPositive ? 'text-role-client-admin' : 'text-destructive'
                )}>
                  {isPositive ? '+' : ''}{change.value}%
                </span>
                <span className="text-xs text-muted-foreground">{change.label}</span>
              </div>
            )}
          </div>
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl bg-secondary',
            iconColor
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </div>
    </div>
  );
};
