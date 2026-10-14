import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Banknote, CreditCard, QrCode, Wallet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { companyService } from '@/services/company';
import { appointmentsService } from '@/services/appointments';

/**
 * "Concluir e receber": o fim do atendimento numa tela so. Antes o barbeiro
 * concluia na agenda, ia ao PDV, procurava o servico, digitava o nome do
 * cliente e escolhia a forma de pagamento — cinco passos para cada cliente.
 *
 * A venda sai pelo mesmo checkout do PDV, entao plano de mensalista,
 * fidelidade e caixa continuam valendo. A comissao do servico vem do
 * atendimento concluido, nao da venda: nao conta em dobro.
 */
export type AtendimentoParaReceber = {
  id: string;
  customer_name?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  /** Valor combinado no atendimento; vazio = preco do servico. */
  price?: number | null;
  /** Preco do servico no cadastro. */
  service_price: number;
};

type Forma = 'dinheiro' | 'pix' | 'credito' | 'debito';

const FORMAS: Array<{ id: Forma; nome: string; icone: React.ElementType }> = [
  { id: 'dinheiro', nome: 'Dinheiro', icone: Banknote },
  { id: 'pix', nome: 'PIX', icone: QrCode },
  { id: 'credito', nome: 'Crédito', icone: CreditCard },
  { id: 'debito', nome: 'Débito', icone: Wallet },
];

const reais = (valor: number) =>
  Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ReceberAtendimentoDialog({
  atendimento,
  onClose,
  onRecebido,
}: {
  atendimento: AtendimentoParaReceber | null;
  onClose: () => void;
  onRecebido: () => void;
}) {
  const [forma, setForma] = useState<Forma | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [plano, setPlano] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pix, setPix] = useState<{ imagem?: string | null; texto?: string | null } | null>(null);

  // Valor combinado menor que o do cadastro entra como desconto; o checkout
  // cobra pelo preco do servico.
  const subtotal = Number(atendimento?.service_price || 0);
  const combinado = atendimento?.price;
  const desconto =
    combinado !== null && combinado !== undefined && Number(combinado) < subtotal ? subtotal - Number(combinado) : 0;

  useEffect(() => {
    setForma(null);
    setPix(null);
    setTotal(null);
    setPlano(null);
    if (!atendimento?.service_id) return;
    setCalculando(true);
    companyService
      .previewPdvCheckout({
        customer_name: atendimento.customer_name || undefined,
        subtotal,
        service_quantity: 1,
        manual_discount: desconto,
        apply_loyalty: true,
      })
      .then((previa: any) => {
        setTotal(Number(previa?.estimated_total ?? Math.max(0, subtotal - desconto)));
        setPlano(previa?.subscription?.enabled ? previa.subscription.plan_name || 'plano' : null);
      })
      .catch(() => setTotal(Math.max(0, subtotal - desconto)))
      .finally(() => setCalculando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atendimento?.id]);

  const concluir = async () => {
    if (!atendimento) return;
    await appointmentsService.updateInternal(atendimento.id, { status: 'concluido' });
  };

  const receber = async () => {
    if (!atendimento?.service_id || !forma) return;
    setEnviando(true);
    try {
      const resultado: any = await companyService.checkoutPdv({
        customerName: atendimento.customer_name || undefined,
        paymentMethod: forma,
        discount: desconto,
        applyLoyalty: true,
        items: [{ itemType: 'service', itemId: atendimento.service_id, quantity: 1 }],
      });
      await concluir();

      const gateway = resultado?.payment_gateway;
      if (resultado?.order?.status === 'pending_pix' && (gateway?.qrCodeImageUrl || gateway?.qrCodeText)) {
        // Com gateway ligado o PIX gera QR Code e a confirmacao chega sozinha.
        setPix({ imagem: gateway.qrCodeImageUrl, texto: gateway.qrCodeText });
        toast.success('Atendimento concluído. Mostre o QR Code ao cliente.');
        onRecebido();
        return;
      }
      toast.success(`Recebido ${reais(Number(resultado?.order?.total ?? total ?? 0))} no ${FORMAS.find((f) => f.id === forma)?.nome}`);
      onRecebido();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível receber');
    } finally {
      setEnviando(false);
    }
  };

  const soConcluir = async () => {
    setEnviando(true);
    try {
      await concluir();
      toast.success('Atendimento concluído');
      onRecebido();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao concluir');
    } finally {
      setEnviando(false);
    }
  };

  const cobertoPeloPlano = total !== null && total <= 0;

  return (
    <Dialog open={!!atendimento} onOpenChange={(open) => !open && !enviando && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Receber</DialogTitle>
          <DialogDescription>
            {atendimento?.service_name || 'Serviço'}
            {atendimento?.customer_name ? ` · ${atendimento.customer_name}` : ''}
          </DialogDescription>
        </DialogHeader>

        {pix ? (
          <div className="space-y-3 text-center">
            {pix.imagem && <img src={pix.imagem} alt="QR Code PIX" className="mx-auto h-56 w-56 rounded border" />}
            {pix.texto && (
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(pix.texto || '');
                  toast.success('Código PIX copiado');
                }}
              >
                Copiar código PIX
              </Button>
            )}
            <p className="text-sm text-muted-foreground">O pagamento é confirmado sozinho quando o cliente pagar.</p>
          </div>
        ) : !atendimento?.service_id ? (
          <p className="text-sm text-muted-foreground">
            Este atendimento está sem serviço escolhido. Edite e escolha o serviço para receber por aqui.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
              <p className="text-4xl font-bold">{calculando || total === null ? '...' : reais(total)}</p>
              {plano && <p className="mt-1 text-sm text-primary">Desconto do plano {plano}</p>}
            </div>

            {cobertoPeloPlano ? (
              <p className="text-sm text-muted-foreground">
                Coberto pelo plano: não há nada a receber. Só concluir o atendimento.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de pagamento">
                {FORMAS.map((item) => {
                  const ativo = forma === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => setForma(item.id)}
                      className={`flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-sm font-medium transition-colors ${
                        ativo ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:border-primary'
                      }`}
                    >
                      <item.icone className="h-5 w-5" />
                      {item.nome}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {pix ? (
            <Button className="w-full" onClick={onClose}>
              Fechar
            </Button>
          ) : cobertoPeloPlano || !atendimento?.service_id ? (
            <Button className="h-12 w-full" onClick={soConcluir} disabled={enviando}>
              {enviando ? 'Concluindo...' : 'Concluir atendimento'}
            </Button>
          ) : (
            <>
              <Button className="h-12 w-full text-base" onClick={receber} disabled={!forma || enviando || calculando}>
                {enviando ? 'Recebendo...' : forma ? `Receber ${total !== null ? reais(total) : ''}` : 'Escolha a forma de pagamento'}
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={soConcluir} disabled={enviando}>
                Só concluir, sem cobrar agora
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
