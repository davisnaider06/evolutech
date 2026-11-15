import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

/**
 * Conteudo da tela atual, com transicao suave entre telas.
 *
 * O Suspense mora aqui dentro (e nao so em volta das rotas, no App): assim,
 * enquanto o codigo de uma tela chega, a barra lateral e o topo continuam na
 * tela e so a area de conteudo mostra o esqueleto. Antes o app inteiro
 * piscava para um spinner a cada troca de tela.
 */

const Bloco: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`esqueleto-vidro rounded-2xl ${className}`} />
);

/** Esqueleto de vidro com brilho passando: o lugar do conteudo ja aparece. */
export const EsqueletoDaTela: React.FC = () => (
  <div role="status" aria-label="Carregando" className="space-y-6">
    <div className="space-y-2">
      <Bloco className="h-8 w-56" />
      <Bloco className="h-4 w-80 max-w-full" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Bloco key={i} className="h-32" />
      ))}
    </div>
    <Bloco className="h-72" />
  </div>
);

/**
 * A transicao de entrada e CSS (.animar-troca-de-tela em index.css), nao
 * framer-motion: os layouts sao carregados na abertura do app, e a biblioteca
 * (o maior pacote do JS inicial) ia junto ate para o cliente que so abria o
 * link de agendamento. A `key` remonta o bloco a cada tela, o que reinicia a
 * animacao. Quem pediu menos movimento no sistema nao ve a animacao (regra
 * global de prefers-reduced-motion).
 */
export const ConteudoDaRota: React.FC = () => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animar-troca-de-tela">
      <Suspense fallback={<EsqueletoDaTela />}>
        <Outlet />
      </Suspense>
    </div>
  );
};
