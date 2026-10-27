/**
 * "Atendimentos para dar baixa": horarios que ja passaram e continuam como
 * pendente ou confirmado.
 *
 * Dar baixa era escondido: tocar no card da agenda, abrir o formulario e achar
 * o botao la dentro. Ninguem fazia, e em outubro havia 31 atendimentos sem
 * baixa — sem ela o cliente nao recebe o pedido de avaliacao, a comissao do
 * barbeiro nao conta e a "ultima visita" do cliente fica errada.
 *
 * Aqui e um toque por atendimento, no topo da Agenda (onde o barbeiro cai ao
 * entrar) e do Painel do dono. Com o modulo de vendas, "Veio" abre o mesmo
 * "Concluir e receber" da agenda, para o dinheiro entrar no caixa.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { companyService } from '@/services/company';
import { appointmentsService } from '@/services/appointments';
import { useCompanyModules } from '@/hooks/useCompanyModules';
import { formatarData, formatarHora } from '@/lib/horario';
import { AtendimentoParaReceber, ReceberAtendimentoDialog } from '@/components/agenda/ReceberAtendimentoDialog';

type SemBaixa = {
  id: string;
  customer_name: string | null;
  service_id: string | null;
  service_name: string | null;
  professional_name: string | null;
  scheduled_at: string;
  price: number | null;
  service_price: number;
};

const quando = (iso: string) => {
  const data = formatarData(iso);
  return data ? `${data.slice(0, 5)} às ${formatarHora(iso)}` : '';
};

export const AtendimentosSemBaixa: React.FC<{ onAlterado?: () => void; mostrarBarbeiro?: boolean }> = ({
  onAlterado,
  mostrarBarbeiro,
}) => {
  const [itens, setItens] = useState<SemBaixa[]>([]);
  const [total, setTotal] = useState(0);
  const [mexendo, setMexendo] = useState<string | null>(null);
  const [receber, setReceber] = useState<AtendimentoParaReceber | null>(null);
  const { hasModuleForCurrentRole } = useCompanyModules();
  const podeReceber = hasModuleForCurrentRole('pdv');

  const buscar = useCallback(async () => {
    try {
      const dados = await companyService.getPendencias();
      setItens(Array.isArray(dados?.sem_baixa) ? dados.sem_baixa : []);
      setTotal(Number(dados?.agendamentos_sem_baixa || 0));
    } catch (_erro) {
      // Bloco de ajuda: se a rede falhar ele some, a agenda continua valendo.
      setItens([]);
      setTotal(0);
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const depois = () => {
    buscar();
    onAlterado?.();
  };

  const marcar = async (item: SemBaixa, status: 'concluido' | 'no_show') => {
    setMexendo(item.id);
    try {
      await appointmentsService.updateInternal(item.id, { status });
      toast.success(status === 'concluido' ? 'Atendimento concluído' : 'Marcado como não veio');
      depois();
    } catch (error: any) {
      toast.error(error.message || 'Não foi possível atualizar');
    } finally {
      setMexendo(null);
    }
  };

  const veio = (item: SemBaixa) => {
    if (!podeReceber) {
      marcar(item, 'concluido');
      return;
    }
    setReceber({
      id: item.id,
      customer_name: item.customer_name,
      service_id: item.service_id,
      service_name: item.service_name,
      price: item.price,
      service_price: item.service_price,
    });
  };

  // O dialogo fica montado mesmo sem itens: depois da ultima baixa no PIX ele
  // ainda precisa mostrar o QR Code.
  const dialogo = (
    <ReceberAtendimentoDialog
      atendimento={receber}
      onClose={() => setReceber(null)}
      // Nao fecha aqui: no PIX o dialogo continua aberto mostrando o QR Code.
      onRecebido={depois}
    />
  );

  if (itens.length === 0) return dialogo;

  return (
    <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
      <h2 className="font-semibold">
        {total === 1 ? '1 atendimento' : `${total} atendimentos`} sem baixa
      </h2>
      <p className="text-sm text-muted-foreground">
        O cliente veio? Um toque e pronto: ele recebe o pedido de avaliação e a comissão conta.
      </p>
      <ul className="mt-3 space-y-2">
        {itens.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-card sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.customer_name || 'Sem cadastro'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {quando(item.scheduled_at)} · {item.service_name || 'Serviço'}
                {mostrarBarbeiro && item.professional_name ? ` · ${item.professional_name}` : ''}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                size="sm"
                className="rounded-full"
                disabled={mexendo === item.id}
                onClick={() => veio(item)}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Veio
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={mexendo === item.id}
                onClick={() => marcar(item, 'no_show')}
              >
                <UserX className="mr-1 h-4 w-4" />
                Não veio
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {total > itens.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Mostrando os {itens.length} mais recentes. Os outros aparecem aqui conforme você dá baixa.
        </p>
      ) : null}

      {dialogo}
    </section>
  );
};
