import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface StatsCardRealtimeProps {
  title: string;
  value: string | number;
  previousValue?: number;
  change?: {
    value: number;
    label: string;
  };
  icon: LucideIcon;
  iconColor?: string;
  className?: string;
  loading?: boolean;
  prefix?: string;
  suffix?: string;
}

export const StatsCardRealtime: React.FC<StatsCardRealtimeProps> = ({
  title,
  value,
  previousValue,
  change,
  icon: Icon,
  iconColor = 'text-primary',
  className,
  loading = false,
  prefix = '',
  suffix = '',
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [value]);

  const calculatedChange = previousValue !== undefined && typeof value === 'number' && previousValue > 0
    ? ((value - previousValue) / previousValue * 100).toFixed(1)
    : change?.value;

  const isPositive = calculatedChange !== undefined && Number(calculatedChange) >= 0;

  if (loading) {
    return (
      <div className={cn(
        'group relative overflow-hidden rounded-xl glass p-6',
        className
      )}>
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </div>
    );
  }

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
            <p className={cn(
              'mt-2 text-3xl font-bold tracking-tight transition-all duration-300',
              isAnimating && 'scale-105 text-primary'
            )}>
              {prefix}{displayValue}{suffix}
            </p>
            {(calculatedChange !== undefined || change) && (
              <div className="mt-2 flex items-center gap-1">
                <span className={cn(
                  'text-sm font-medium',
                  isPositive ? 'text-green-500' : 'text-destructive'
                )}>
                  {isPositive ? '+' : ''}{calculatedChange}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {change?.label || 'vs. período anterior'}
                </span>
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
