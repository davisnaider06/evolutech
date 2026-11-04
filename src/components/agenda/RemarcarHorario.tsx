import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatarDiaHora, hojeNaBarbearia } from '@/lib/horario';
import { customerPortalService } from '@/services/customer-portal';
import type { CustomerAppointment } from '@/types/customer-portal';

const DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Proximos 14 dias da barbearia, sem depender do fuso do aparelho. */
const proximosDias = () => {
  const [ano, mes, dia] = hojeNaBarbearia().split('-').map(Number);
  return Array.from({ length: 14 }).map((_, indice) => {
    const data = new Date(Date.UTC(ano, mes - 1, dia + indice, 12));
    return {
      iso: data.toISOString().slice(0, 10),
      semana: indice === 0 ? 'Hoje' : indice === 1 ? 'Amanhã' : DIAS_DA_SEMANA[data.getUTCDay()],
      dia: data.getUTCDate(),
      mes: MESES[data.getUTCMonth()],
    };
  });
};

/**
 * Troca o dia/hora de um agendamento do cliente, com o mesmo servico e o
 * mesmo barbeiro. O horario atual so e liberado quando o novo e gravado (o
 * backend faz as duas coisas juntas), entao o cliente nunca fica sem nenhum.
 */
export const RemarcarHorario: React.FC<{
  agendamento: CustomerAppointment | null;
  onFechar: () => void;
  onRemarcado: () => void;
  onCancelar: (agendamento: CustomerAppointment) => void;
}> = ({ agendamento, onFechar, onRemarcado, onCancelar }) => {
  const dias = useMemo(proximosDias, []);
  const [data, setData] = useState('');
  const [horarios, setHorarios] = useState<Array<{ time: string; scheduled_at: string }>>([]);
  const [carregando, setCarregando] = useState(false);
  const [escolhido, setEscolhido] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    setData('');
    setHorarios([]);
    setEscolhido('');
    setAviso('');
  }, [agendamento?.id]);

  useEffect(() => {
    if (!agendamento || !data || !agendamento.service_id || !agendamento.professional_id) return;
    let ativo = true;
    setCarregando(true);
    setEscolhido('');
    setAviso('');
    customerPortalService
      .appointmentSlots({
        date: data,
        service_id: agendamento.service_id,
        professional_id: agendamento.professional_id,
        ignorar_id: agendamento.id,
      })
      .then((resposta: any) => {
        if (!ativo) return;
        setHorarios(Array.isArray(resposta?.slots) ? resposta.slots : []);
        if (resposta?.plan_block?.message) setAviso(resposta.plan_block.message);
      })
      .catch((erro: any) => {
        if (!ativo) return;
        setHorarios([]);
        setAviso(erro?.message || 'Não foi possível carregar os horários.');
      })
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [agendamento, data, recarga]);

  const semDadosParaRemarcar = Boolean(agendamento && (!agendamento.service_id || !agendamento.professional_id));

  const confirmar = async () => {
    if (!agendamento || !escolhido) return;
    setSalvando(true);
    try {
      const novo = await customerPortalService.rescheduleAppointment(agendamento.id, escolhido);
      toast.success(`Horário alterado para ${formatarDiaHora(novo.scheduled_at)}`);
      onRemarcado();
    } catch (erro: any) {
      // Alguem pegou esse horario no meio do caminho: atualiza a lista e
      // mostra o motivo depois dela.
      const motivo = erro?.message || 'Não foi possível trocar o horário.';
      toast.error(motivo);
      setRecarga((n) => n + 1);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={!!agendamento} onOpenChange={(aberto) => !aberto && !salvando && onFechar()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Alterar horário</DialogTitle>
          <DialogDescription>
            {agendamento
              ? `${agendamento.service_name || 'Serviço'} com ${agendamento.professional_name || 'o barbeiro'}, hoje marcado para ${formatarDiaHora(agendamento.scheduled_at)}.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {semDadosParaRemarcar ? (
          <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">
            Este horário foi marcado pela barbearia. Para trocar, fale com eles.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">Novo dia</p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label="Dia">
                {dias.map((item) => (
                  <button
                    key={item.iso}
                    type="button"
                    role="option"
                    aria-selected={data === item.iso}
                    onClick={() => setData(item.iso)}
                    className={cn(
                      'flex min-h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border text-xs transition-colors',
                      data === item.iso
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card hover:border-primary/50'
                    )}
                  >
                    <span>{item.semana}</span>
                    <span className="text-base font-semibold">{item.dia}</span>
                    <span className="opacity-70">{item.mes}</span>
                  </button>
                ))}
              </div>
            </div>

            {data ? (
              <div>
                <p className="mb-2 text-sm font-semibold">Novo horário</p>
                {carregando ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Procurando horários livres…
                  </div>
                ) : horarios.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    {aviso || 'Nenhum horário livre nesse dia. Tente outro.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {horarios.map((slot) => (
                      <button
                        key={slot.scheduled_at}
                        type="button"
                        aria-pressed={escolhido === slot.scheduled_at}
                        onClick={() => setEscolhido(slot.scheduled_at)}
                        className={cn(
                          'min-h-11 rounded-full border text-sm font-medium transition-colors',
                          escolhido === slot.scheduled_at
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card hover:border-primary/50'
                        )}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {aviso && horarios.length > 0 ? (
              <p className="text-sm text-destructive" role="alert">
                {aviso}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {!semDadosParaRemarcar ? (
            <Button className="h-12 w-full rounded-full" onClick={confirmar} disabled={!escolhido || salvando}>
              {salvando ? 'Trocando…' : escolhido ? `Trocar para ${formatarDiaHora(escolhido)}` : 'Escolha o novo horário'}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="h-11 w-full rounded-full text-destructive hover:text-destructive"
            disabled={salvando}
            onClick={() => agendamento && onCancelar(agendamento)}
          >
            Cancelar este horário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
