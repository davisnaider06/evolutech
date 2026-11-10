import React, { useState } from 'react';

/**
 * Foto ja desfocada no arquivo (gerada de barbearia-capa.jpg com ffmpeg,
 * 360 px e gblur). Desfocar no CSS com `blur-2xl` custava GPU em toda
 * rolagem; o arquivo tem 7 KB e chega antes do resto da tela.
 */
const FOTO_PADRAO = '/imagens/fundo-painel.jpg';

/**
 * Fundo do painel: a foto da barbearia virando luz ambiente quente, com um
 * escurecimento por cima para o texto branco dos paineis ter contraste. Fixo,
 * para nao rolar junto com o conteudo. Aparece com fade quando a imagem
 * carrega, em vez de "estourar" na tela.
 */
export const FundoVidro: React.FC<{ foto?: string | null }> = ({ foto }) => {
  const [carregou, setCarregou] = useState(false);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[hsl(24_14%_7%)]">
      <img
        src={foto || FOTO_PADRAO}
        alt=""
        decoding="async"
        onLoad={() => setCarregou(true)}
        className={
          'absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1400ms] ease-out ' +
          (carregou ? 'opacity-90 scale-105' : 'opacity-0 scale-110')
        }
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.22),transparent_55%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/55 to-black/70" />
    </div>
  );
};
