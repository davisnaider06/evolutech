import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { customerPortalService } from '@/services/customer-portal';
import type { CustomerAppointment } from '@/types/customer-portal';
import { nomeCurto } from '@/lib/profissional';
import { EscolhaEstrelas } from './Estrelas';

interface Props {
  atendimento: CustomerAppointment | null;
  /** Nome da barbearia, para a segunda pergunta nao ficar generica. */
  nomeBarbearia?: string | null;
  onClose: () => void;
  onAvaliado: () => void;
}

/**
 * Janela onde o cliente da as notas do atendimento. Abre pelo portal ou pelo
 * push.
 *
 * Duas notas: o corte (vai para o barbeiro) e a barbearia (ambiente,
 * atendimento, pontualidade). Com uma nota so, a espera na recepcao derrubava
 * a nota de quem cortou.
 */
const AvaliarAtendimento: React.FC<Props> = ({ atendimento, nomeBarbearia, onClose, onAvaliado }) => {
  const [nota, setNota] = useState(0);
  const [notaBarbearia, setNotaBarbearia] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setNota(0);
    setNotaBarbearia(0);
    setComentario('');
  }, [atendimento?.id]);

  const barbeiro = nomeCurto(atendimento?.professional_name) || 'o barbeiro';

  const enviar = async () => {
    if (!atendimento || !nota || !notaBarbearia) return;
    setEnviando(true);
    try {
      await customerPortalService.reviewAppointment(atendimento.id, {
        rating: nota,
        rating_empresa: notaBarbearia,
        comment: comentario,
      });
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
      <DialogContent className="max-h-[92dvh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Como foi o atendimento?</DialogTitle>
          <DialogDescription>
            {atendimento?.service_name || 'Serviço'} com {atendimento?.professional_name || 'o profissional'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-center">
          <p className="text-sm font-semibold">O corte com {barbeiro}</p>
          <EscolhaEstrelas valor={nota} onChange={setNota} rotulo={`Nota do corte com ${barbeiro}`} />
        </div>

        {/* A segunda pergunta so aparece depois da primeira: duas fileiras de
            estrelas de uma vez pareciam um formulario. */}
        {nota ? (
          <div className="space-y-1 border-t pt-4 text-center">
            <p className="text-sm font-semibold">E a {nomeBarbearia || 'barbearia'}?</p>
            <p className="text-xs text-muted-foreground">Ambiente, atendimento e pontualidade</p>
            <EscolhaEstrelas valor={notaBarbearia} onChange={setNotaBarbearia} rotulo="Nota da barbearia" />
          </div>
        ) : null}

        {nota && notaBarbearia ? (
          <Textarea
            placeholder="Quer contar mais? (opcional)"
            maxLength={500}
            rows={3}
            value={comentario}
            onChange={(event) => setComentario(event.target.value)}
          />
        ) : null}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          O barbeiro vê a nota do corte e o comentário, mas não sabe que foi você. A nota da barbearia vai só
          para o dono.
        </p>
        <Button className="h-11 w-full" disabled={!nota || !notaBarbearia || enviando} onClick={enviar}>
          {enviando ? 'Enviando...' : !nota ? 'Dê uma nota para o corte' : !notaBarbearia ? 'Dê uma nota para a barbearia' : 'Enviar avaliação'}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default AvaliarAtendimento;
