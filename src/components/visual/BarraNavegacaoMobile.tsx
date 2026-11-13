import React from 'react';
import { cn } from '@/lib/utils';

export interface ItemNavegacao {
  id: string;
  rotulo: string;
  icone: React.ElementType;
  ativo: boolean;
  onClick: () => void;
}

/**
 * Pilula escura flutuante no rodape do celular: icone em cima, rotulo embaixo.
 * Fica a --nav-offset das bordas e respeita a area segura do iPhone. Quem usa
 * precisa dar ao conteudo o padding de `pb-nav-seguro` (ver index.css).
 */
export const BarraNavegacaoMobile: React.FC<{ itens: ItemNavegacao[]; rotulo?: string; className?: string }> = ({
  itens,
  rotulo = 'Navegação principal',
  className,
}) => (
  <nav
    aria-label={rotulo}
    className={cn(
      'fixed inset-x-nav-offset bottom-[calc(var(--nav-offset)+env(safe-area-inset-bottom))] z-30 grid h-nav-h rounded-full bg-nav px-2 shadow-float lg:hidden',
      className,
    )}
    style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}
  >
    {itens.map(({ id, rotulo: texto, icone: Icone, ativo, onClick }) => (
      <button
        key={id}
        type="button"
        onClick={onClick}
        aria-current={ativo ? 'page' : undefined}
        className={cn(
          'flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-full text-legenda outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary',
          ativo ? 'font-semibold text-nav-foreground' : 'text-nav-foreground/70 hover:text-nav-foreground',
        )}
      >
        <Icone
          className="h-5 w-5"
          strokeWidth={ativo ? 2 : 1.5}
          fill={ativo ? 'currentColor' : 'none'}
          aria-hidden
        />
        <span className="max-w-full truncate px-1">{texto}</span>
      </button>
    ))}
  </nav>
);
