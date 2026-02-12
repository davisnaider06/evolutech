import React from 'react';
import { cn } from '@/lib/utils';
import logoEvolutech from '@/assets/logo-evolutech.png';
import logoWordmark from '@/assets/logo-evolutech-wordmark.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'icon' | 'wordmark' | 'full';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  showText = true,
  variant = 'full',
  className 
}) => {
  const sizes = {
    sm: { icon: 'w-6 h-6', text: 'text-sm', wordmark: 'h-6' },
    md: { icon: 'w-8 h-8', text: 'text-lg', wordmark: 'h-8' },
    lg: { icon: 'w-10 h-10', text: 'text-xl', wordmark: 'h-10' },
    xl: { icon: 'w-12 h-12', text: 'text-2xl', wordmark: 'h-14' },
  };

  // Wordmark only variant (cinematic logo)
  if (variant === 'wordmark') {
    return (
      <img 
        src={logoWordmark} 
        alt="Evolutech" 
        className={cn(sizes[size].wordmark, 'object-contain', className)}
      />
    );
  }

  // Icon only variant
  if (variant === 'icon') {
    return (
      <img 
        src={logoEvolutech} 
        alt="Evolutech" 
        className={cn(sizes[size].icon, 'object-contain', className)}
      />
    );
  }

  // Full variant with icon and text
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img 
        src={logoEvolutech} 
        alt="Evolutech" 
        className={cn(sizes[size].icon, 'object-contain')}
      />
      
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={cn(
            'font-bold tracking-tight text-gradient',
            sizes[size].text
          )}>
            EVOLUTECH
          </span>
          <span className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase">
            Digital
          </span>
        </div>
      )}
    </div>
  );
};
