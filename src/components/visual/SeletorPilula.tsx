import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface SeletorPilulaProps<T extends string> {
  valor: T;
  opcoes: readonly T[];
  onChange: (valor: T) => void;
  rotuloAcessivel: string;
  className?: string;
}

/** Pilula branca com texto + chevron que abre a lista de opcoes. */
export function SeletorPilula<T extends string>({ valor, opcoes, onChange, rotuloAcessivel, className }: SeletorPilulaProps<T>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${rotuloAcessivel}: ${valor}`}
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 rounded-full bg-card px-4 text-rotulo font-medium text-foreground shadow-card outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        {valor}
        <ChevronDown className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem] rounded-tooltip">
        {opcoes.map((opcao) => (
          <DropdownMenuItem key={opcao} onSelect={() => onChange(opcao)} className="min-h-11 justify-between rounded-lg">
            {opcao}
            {opcao === valor && <Check className="h-4 w-4 text-primary" strokeWidth={1.75} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
