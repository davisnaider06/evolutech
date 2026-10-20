import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'icon' | 'wordmark' | 'full';
  className?: string;
}

const sizes = {
  sm: { icon: 'w-6 h-6', text: 'text-base' },
  md: { icon: 'w-8 h-8', text: 'text-lg' },
  lg: { icon: 'w-10 h-10', text: 'text-xl' },
  xl: { icon: 'w-12 h-12', text: 'text-2xl' },
};

/**
 * Marca iBarber desenhada em SVG: uma tesoura aberta dentro do quadrado.
 * Usa a cor primaria do tema, entao acompanha a paleta de cada barbearia.
 */
export const LogoMarca: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 40 40" role="img" aria-label="iBarber" className={className}>
    <rect width="40" height="40" rx="10" className="fill-primary" />
    <g fill="none" className="stroke-primary-foreground" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="13" cy="27" r="4" />
      <circle cx="27" cy="27" r="4" />
      <path d="M15.8 24.2 27 9M24.2 24.2 13 9" />
    </g>
  </svg>
);

const Nome: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cn('font-bold tracking-tight', className)}>
    <span className="text-primary">i</span>Barber
  </span>
);

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  variant = 'full',
  className,
}) => {
  if (variant === 'wordmark') {
    return <Nome className={cn(sizes[size].text, className)} />;
  }

  if (variant === 'icon') {
    return <LogoMarca className={cn(sizes[size].icon, className)} />;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <LogoMarca className={sizes[size].icon} />
      {showText && <Nome className={sizes[size].text} />}
    </div>
  );
};
