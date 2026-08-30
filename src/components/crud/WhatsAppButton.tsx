import React from 'react';
import { linkWhatsApp } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

/**
 * Icone oficial do WhatsApp.
 *
 * Vai inline porque o lucide-react nao traz icones de marca — e o cliente
 * reconhece o balao verde de imediato, que e justamente o ponto de ter o
 * atalho na linha.
 */
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
);

interface WhatsAppButtonProps {
  phone?: string | null;
  /** Nome de quem vai receber, so para o titulo ficar claro no hover. */
  name?: string | null;
  /** Texto que ja vai digitado na conversa. Opcional. */
  message?: string;
  /** `icon` para dentro de tabela; `button` quando precisa de rotulo. */
  variant?: 'icon' | 'button';
  label?: string;
  className?: string;
}

/**
 * Abre a conversa do cliente no WhatsApp, direto.
 *
 * Sem telefone valido o atalho nao aparece: um botao que abre uma aba de erro
 * e pior do que botao nenhum.
 */
export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
  phone,
  name,
  message,
  variant = 'icon',
  label = 'WhatsApp',
  className,
}) => {
  const href = linkWhatsApp(phone, message);
  if (!href) return null;

  const titulo = name ? `Conversar com ${name} no WhatsApp` : 'Abrir conversa no WhatsApp';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={titulo}
      aria-label={titulo}
      // A linha da tabela costuma ter o proprio clique (abrir/editar):
      // sem isto, tocar no icone abriria as duas coisas.
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-[#25D366] transition-colors',
        'hover:bg-[#25D366]/10 hover:text-[#1DA851]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-1',
        variant === 'icon' ? 'h-8 w-8' : 'h-9 px-3 text-sm font-medium',
        className
      )}
    >
      <WhatsAppIcon className="h-4 w-4" />
      {variant === 'button' && <span>{label}</span>}
    </a>
  );
};

export default WhatsAppButton;
