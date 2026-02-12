import React from 'react';
import { cn } from '@/lib/utils';
import logoWordmark from '@/assets/logo-evolutech-wordmark.png';

interface LogoWordmarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const LogoWordmark: React.FC<LogoWordmarkProps> = ({ 
  size = 'md', 
  className 
}) => {
  const sizes = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
    xl: 'h-14',
  };

  return (
    <img 
      src={logoWordmark} 
      alt="Evolutech" 
      className={cn(sizes[size], 'object-contain', className)}
    />
  );
};
