/**
 * Tela de entrada com foto de barbearia ao fundo (prototipo em
 * design-references/image.png): foto em tela cheia, escurecida de baixo para
 * cima, e o conteudo no rodape — titulo grande, botao dourado em pilula e o
 * "Ja tem conta? Entrar" embaixo.
 *
 * Toda porta de entrada usa esta moldura (escolha de acesso, login da equipe,
 * login e cadastro do cliente, boas-vindas do link da barbearia), para a troca
 * de tela nao parecer outro sistema.
 *
 * Foto padrao: Unsplash (licenca livre para uso comercial), em
 * public/imagens/barbearia-capa.jpg. A barbearia pode ter a propria no futuro
 * (CompanyTheme.loginCoverPath ja existe no banco).
 */
import React from 'react';
import { cn } from '@/lib/utils';

export const FOTO_PADRAO = '/imagens/barbearia-capa.jpg';

interface Props {
  children: React.ReactNode;
  foto?: string | null;
  /** Conteudo acima do titulo, colado no topo (logo, voltar). */
  topo?: React.ReactNode;
  className?: string;
}

export const TelaComFoto: React.FC<Props> = ({ children, foto, topo, className }) => (
  <div className="relative min-h-[100dvh] overflow-hidden bg-neutral-950 text-white">
    <img
      src={foto || FOTO_PADRAO}
      alt=""
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
    />
    {/* Escurece de baixo para cima: o texto branco precisa de fundo escuro em
        qualquer foto, e o rosto no alto continua aparecendo. */}
    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/95" />

    <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col px-6 pb-8 pt-6">
      {topo ? <div className="flex items-center justify-between">{topo}</div> : null}
      <div className={cn('mt-auto flex flex-col', className)}>{children}</div>
    </div>
  </div>
);

/** "Find my / Barber": linha pequena em cima, palavra grande embaixo. */
export const TituloFoto: React.FC<{ linha: string; destaque: string; descricao?: React.ReactNode }> = ({
  linha,
  destaque,
  descricao,
}) => (
  <div className="text-center">
    <p className="text-xl font-semibold leading-tight">{linha}</p>
    <h1 className="break-words text-[2.75rem] font-bold leading-[1.05] tracking-tight">{destaque}</h1>
    {descricao ? <p className="mx-auto mt-3 max-w-[18rem] text-[15px] leading-relaxed text-white/80">{descricao}</p> : null}
  </div>
);

/** As bolinhas do prototipo: a ativa e um traco dourado. */
export const PontosFoto: React.FC<{ total: number; ativo: number; onEscolher?: (indice: number) => void }> = ({
  total,
  ativo,
  onEscolher,
}) => (
  <div className="mt-5 flex items-center justify-center gap-1.5">
    {Array.from({ length: total }).map((_, indice) => (
      <button
        key={indice}
        type="button"
        aria-label={`Mensagem ${indice + 1} de ${total}`}
        onClick={() => onEscolher?.(indice)}
        className={cn(
          'h-1.5 rounded-full transition-all',
          indice === ativo ? 'w-6 bg-primary' : 'w-1.5 bg-white/50'
        )}
      />
    ))}
  </div>
);

/** Botao dourado em pilula, largura toda. */
export const botaoFoto =
  'flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-black/30 transition-transform active:scale-[0.98] disabled:opacity-60';

/** Botao secundario sobre a foto: contorno branco. */
export const botaoFotoContorno =
  'flex h-14 w-full items-center justify-center gap-2 rounded-full border border-white/40 bg-white/5 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10';

/** Campo de texto sobre a foto: vidro escuro, texto branco. */
export const campoFoto =
  'h-12 w-full rounded-full border border-white/20 bg-white/10 px-5 text-[15px] text-white placeholder:text-white/50 backdrop-blur-md outline-none transition-colors focus:border-primary focus:bg-white/15';

export const rotuloFoto = 'mb-1.5 block pl-4 text-xs font-medium uppercase tracking-wide text-white/70';

/** "Ja tem conta? Entrar" — texto claro com o link em dourado. */
// Dourado mais claro que o --primary: no fundo quase preto o tom do botao
// fica apagado como texto.
export const linkFoto = 'font-semibold text-[#d9b65f] hover:underline';
