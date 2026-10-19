import React from 'react';
import { toast } from 'sonner';
import { Copy, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * O link que o dono divulga (Instagram, status, WhatsApp). E a porta do
 * cliente: ele cai direto na escolha do horario e so cria a conta no fim.
 * A equipe entra por outro caminho, o /login.
 */
const linkDosClientes = (slug?: string | null) =>
  slug ? `${window.location.origin}/agendar/${slug}` : '';

const LinkDosClientes: React.FC<{ slug?: string | null; nomeEmpresa?: string | null }> = ({
  slug,
  nomeEmpresa,
}) => {
  const link = linkDosClientes(slug);

  const copiar = async () => {
    if (!link) {
      toast.error('Não foi possível gerar o link de agendamento');
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copiado. Cole no Instagram, no status ou no WhatsApp.');
    } catch (_error) {
      toast.error('Não consegui copiar. Segure o dedo no link para copiar.');
    }
  };

  const mensagem = `Agende seu horário${nomeEmpresa ? ` na ${nomeEmpresa}` : ''} pelo link: ${link}`;

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="font-medium">Link para seus clientes agendarem</p>
      <p className="mt-1 text-sm text-muted-foreground">
        O cliente escolhe serviço, barbeiro e horário, e só no fim cria a conta. O
        agendamento cai direto na agenda.
      </p>
      <p className="mt-3 break-all rounded-md bg-muted px-3 py-2 text-sm font-medium">
        {link || 'indisponível'}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={copiar} className="gap-2" disabled={!link}>
          <Copy className="h-4 w-4" />
          Copiar link
        </Button>
        <Button asChild variant="outline" className="gap-2" disabled={!link}>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar pelo WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
};

export default LinkDosClientes;
