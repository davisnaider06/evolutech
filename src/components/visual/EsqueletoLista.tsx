import React from 'react';
import { cn } from '@/lib/utils';

interface EsqueletoListaProps {
  /** Lido pelo leitor de tela no lugar do antigo "Carregando...". */
  rotulo?: string;
  linhas?: number;
  className?: string;
}

/**
 * Lugar do conteudo enquanto ele chega (melhoria 1): linhas com o brilho do
 * .esqueleto-vidro no formato de uma lista, em vez do texto "Carregando...".
 * A tela nao "pula" quando os dados chegam.
 */
export const EsqueletoLista: React.FC<EsqueletoListaProps> = ({ rotulo = 'Carregando', linhas = 3, className }) => (
  <div role="status" aria-label={rotulo} className={cn('space-y-2', className)}>
    {Array.from({ length: linhas }, (_, indice) => (
      <div key={indice} className="esqueleto-vidro h-11 rounded-2xl" style={{ opacity: 1 - indice * 0.15 }} />
    ))}
  </div>
);
