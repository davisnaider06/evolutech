import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, CreditCard, QrCode, Wallet, Printer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <>
      <Card className="border-primary/40">
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
          <div>
            <CardTitle>Caixa de hoje</CardTitle>
            <CardDescription>{formatarData(new Date())}</CardDescription>
          </div>
          <Button onClick={() => setFechando(true)} disabled={!resumo}>
            Fechar o dia
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-4xl font-bold">{resumo ? reais(resumo.total) : '...'}</p>
            <p className="text-sm text-muted-foreground">
              {resumo ? `${resumo.vendas} ${resumo.vendas === 1 ? 'recebimento' : 'recebimentos'} hoje` : 'Carregando...'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['dinheiro', 'pix', 'credito', 'debito'] as const).map((forma) => {
              const Icone = FORMAS[forma].icone;
              return (
                <div key={forma} className="rounded-lg border p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icone className="h-3.5 w-3.5" />
                    {FORMAS[forma].nome}
                  </p>
                  <p className="text-lg font-semibold">{reais(valorDe(forma))}</p>
                </div>
              );
            })}
          </div>
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
