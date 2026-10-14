import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Banknote, CreditCard, QrCode, Wallet, Printer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { companyService } from '@/services/company';
import { formatarData, hojeNaBarbearia } from '@/lib/horario';

/**
 * O que o dono quer ao abrir o Caixa: quanto entrou hoje e como. Os
 * relatorios por periodo continuam na tela, mas atras de um botao.
 *
 * "Fechar o dia" e a conferencia: quanto tem de estar na gaveta (dinheiro)
 * e quanto caiu no PIX e na maquininha, para bater com o extrato.
 */
const FORMAS: Record<string, { nome: string; icone: React.ElementType }> = {
  dinheiro: { nome: 'Dinheiro', icone: Banknote },
  pix: { nome: 'PIX', icone: QrCode },
  credito: { nome: 'Crédito', icone: CreditCard },
  debito: { nome: 'Débito', icone: Wallet },
  cartao: { nome: 'Cartão', icone: CreditCard },
};

const reais = (valor: number) =>
  Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Resumo = {
  total: number;
  vendas: number;
  porForma: Array<{ forma: string; total: number }>;
  entradas: number;
  saidas: number;
};

export function CaixaDoDia({ atualizar }: { atualizar: number }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [fechando, setFechando] = useState(false);
  const hoje = hojeNaBarbearia();

  const carregar = useCallback(async () => {
    try {
      const dados: any = await companyService.getCashOverview({ dateFrom: hoje, dateTo: hoje, referenceDate: hoje, pageSize: 1 });
      setResumo({
        total: Number(dados?.selected_period?.total_received || 0),
        vendas: Number(dados?.selected_period?.sales_count || 0),
        porForma: (dados?.selected_period?.payment_methods || []).map((item: any) => ({
          forma: String(item.payment_method || '').toLowerCase(),
          total: Number(item.total || 0),
        })),
        entradas: Number(dados?.manual_period?.total_entries || 0),
        saidas: Number(dados?.manual_period?.total_exits || 0),
      });
    } catch {
      setResumo({ total: 0, vendas: 0, porForma: [], entradas: 0, saidas: 0 });
    }
  }, [hoje]);

  useEffect(() => {
    carregar();
  }, [carregar, atualizar]);

  const valorDe = (forma: string) => resumo?.porForma.find((item) => item.forma === forma)?.total || 0;
  const cartoes = valorDe('credito') + valorDe('debito') + valorDe('cartao');
  const naGaveta = valorDe('dinheiro') + (resumo?.entradas || 0) - (resumo?.saidas || 0);

  const entradasDoDia = (resumo?.total || 0) + (resumo?.entradas || 0);
  const saldoDoDia = entradasDoDia - (resumo?.saidas || 0);
  const formasComValor = (['dinheiro', 'pix', 'credito', 'debito'] as const).filter((forma) => valorDe(forma) > 0);

  // Uma faixa so: o dono bate o olho e ve o dia sem rolar a tela.
  return (
    <>
      <Card className="border-primary/40">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Caixa de hoje</p>
              <p className="text-xs text-muted-foreground">{formatarData(new Date())}</p>
            </div>
            <Button size="sm" onClick={() => setFechando(true)} disabled={!resumo}>
              Fechar o dia
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2.5">
              <p className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                <ArrowUpCircle className="h-3.5 w-3.5" />
                Entradas
              </p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {resumo ? reais(entradasDoDia) : '...'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {resumo ? `${resumo.vendas} ${resumo.vendas === 1 ? 'recebimento' : 'recebimentos'}` : ''}
              </p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-2.5">
              <p className="flex items-center gap-1 text-xs text-red-700 dark:text-red-400">
                <ArrowDownCircle className="h-3.5 w-3.5" />
                Saídas
              </p>
              <p className="text-lg font-bold text-red-700 dark:text-red-400">
                {resumo ? reais(resumo.saidas) : '...'}
              </p>
            </div>
            <div className="rounded-lg border p-2.5">
              <p className="text-xs text-muted-foreground">Saldo do dia</p>
              <p className="text-lg font-bold">{resumo ? reais(saldoDoDia) : '...'}</p>
            </div>
          </div>

          {formasComValor.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {formasComValor.map((forma) => {
                const Icone = FORMAS[forma].icone;
                return (
                  <span key={forma} className="flex items-center gap-1">
                    <Icone className="h-3.5 w-3.5" />
                    {FORMAS[forma].nome} <span className="font-medium text-foreground">{reais(valorDe(forma))}</span>
                  </span>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={fechando} onOpenChange={setFechando}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fechamento de {formatarData(new Date())}</DialogTitle>
            <DialogDescription>Confira com a gaveta, o extrato do PIX e a maquininha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <Linha rotulo="Vendas em dinheiro" valor={valorDe('dinheiro')} />
            <Linha rotulo="Entradas lançadas" valor={resumo?.entradas || 0} />
            <Linha rotulo="Saídas lançadas (sangria, despesas)" valor={-(resumo?.saidas || 0)} />
            <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 font-semibold">
              <span>Deve ter na gaveta</span>
              <span>{reais(naGaveta)}</span>
            </div>
            <div className="pt-2" />
            <Linha rotulo="PIX" valor={valorDe('pix')} />
            <Linha rotulo="Cartão (crédito + débito)" valor={cartoes} />
            <div className="flex items-center justify-between border-t pt-2 text-base font-bold">
              <span>Total recebido no dia</span>
              <span>{reais(resumo?.total || 0)}</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
            <Button onClick={() => setFechando(false)}>Conferido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-center justify-between px-3">
      <span className="text-muted-foreground">{rotulo}</span>
      <span>{reais(valor)}</span>
    </div>
  );
}
