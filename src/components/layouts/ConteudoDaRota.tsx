import React, { Suspense, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';

/**
 * Conteudo da tela atual, com transicao suave entre telas.
 *
 * O Suspense mora aqui dentro (e nao so em volta das rotas, no App): assim,
 * enquanto o codigo de uma tela chega, a barra lateral e o topo continuam na
 * tela e so a area de conteudo mostra o esqueleto. Antes o app inteiro
 * piscava para um spinner a cada troca de tela.
 */

/** Guarda a tela que estava montada, para ela sair animando sem virar a nova. */
const TelaCongelada: React.FC = () => {
  const outlet = useOutlet();
  const [tela] = useState(outlet);
  return tela;
};

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

export const ConteudoDaRota: React.FC = () => {
  const location = useLocation();
  return (
    // reducedMotion="user": quem pediu menos movimento no sistema troca de
    // tela sem deslizar (o CSS global nao alcanca o framer-motion).
    <MotionConfig reducedMotion="user">
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } }}
        exit={{ opacity: 0, y: -6, transition: { duration: 0.14, ease: 'easeIn' } }}
      >
        <Suspense fallback={<EsqueletoDaTela />}>
          <TelaCongelada />
        </Suspense>
      </motion.div>
    </AnimatePresence>
    </MotionConfig>
  );
};
