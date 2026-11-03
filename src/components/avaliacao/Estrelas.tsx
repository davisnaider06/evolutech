import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NotaProfissional {
  media: number;
  total: number;
}

/** Estrelas so para ler (cards, ranking). Arredonda para a estrela inteira mais proxima. */
export const Estrelas: React.FC<{ nota: number; tamanho?: string; className?: string }> = ({
  nota,
  tamanho = 'h-3.5 w-3.5',
  className,
}) => (
  <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${nota.toFixed(1)} de 5 estrelas`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        aria-hidden
        className={cn(tamanho, i <= Math.round(nota) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')}
      />
    ))}
  </span>
);

/** "4.8 (23)" — o formato curto que vai embaixo do nome do barbeiro. */
export const NotaCurta: React.FC<{ rating?: NotaProfissional | null; className?: string }> = ({ rating, className }) => {
  if (!rating) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] text-muted-foreground', className)}>
      <Star aria-hidden className="h-3 w-3 fill-amber-400 text-amber-400" />
      <span className="font-medium text-foreground">{rating.media.toFixed(1)}</span>
      <span>({rating.total})</span>
    </span>
  );
};

const ROTULOS = ['', 'Ruim', 'Fraco', 'Ok', 'Bom', 'Excelente'];

/** Escolha da nota: cinco estrelas grandes, faceis de tocar no celular. */
export const EscolhaEstrelas: React.FC<{
  valor: number;
  onChange: (nota: number) => void;
  /** Quando ha mais de uma nota na mesma tela (corte e barbearia). */
  rotulo?: string;
}> = ({ valor, onChange, rotulo = 'Nota' }) => {
  const [sobre, setSobre] = useState(0);
  const exibida = sobre || valor;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1" role="radiogroup" aria-label={rotulo} onMouseLeave={() => setSobre(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={valor === i}
            aria-label={`${i} ${i === 1 ? 'estrela' : 'estrelas'}`}
            onMouseEnter={() => setSobre(i)}
            onClick={() => onChange(i)}
            className="rounded-md p-1 transition-transform active:scale-90"
          >
            <Star
              className={cn(
                'h-10 w-10 transition-colors',
                i <= exibida ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
              )}
            />
          </button>
        ))}
      </div>
      <p className="h-5 text-sm font-medium text-muted-foreground">{ROTULOS[exibida]}</p>
    </div>
  );
};
