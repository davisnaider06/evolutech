import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { customerPortalService } from '@/services/customer-portal';
import type { CustomerAppointment } from '@/types/customer-portal';
import { EscolhaEstrelas } from './Estrelas';

interface Props {
  atendimento: CustomerAppointment | null;
  onClose: () => void;
  onAvaliado: () => void;
}

/** Janela onde o cliente da a nota do corte. Abre pelo portal ou pelo push. */
const AvaliarAtendimento: React.FC<Props> = ({ atendimento, onClose, onAvaliado }) => {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setNota(0);
    setComentario('');
  }, [atendimento?.id]);

  const enviar = async () => {
    if (!atendimento || !nota) return;
    setEnviando(true);
    try {
      await customerPortalService.reviewAppointment(atendimento.id, { rating: nota, comment: comentario });
      toast.success('Obrigado pela avaliação!');
      onAvaliado();
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível enviar a avaliação');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={Boolean(atendimento)} onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Como foi o atendimento?</DialogTitle>
          <DialogDescription>
            {atendimento?.service_name || 'Serviço'} com {atendimento?.professional_name || 'o profissional'}
          </DialogDescription>
        </DialogHeader>
        <EscolhaEstrelas valor={nota} onChange={setNota} />
        <Textarea
          placeholder="Quer contar mais? (opcional)"
          maxLength={500}
          rows={3}
          value={comentario}
          onChange={(event) => setComentario(event.target.value)}
        />
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          O barbeiro vê a nota e o comentário, mas não sabe que foi você.
        </p>
        <Button className="h-11 w-full" disabled={!nota || enviando} onClick={enviar}>
          {enviando ? 'Enviando...' : 'Enviar avaliação'}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default AvaliarAtendimento;
