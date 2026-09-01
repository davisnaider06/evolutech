import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { companyService } from '@/services/company';
import { useIsMobile } from '@/hooks/use-mobile';
import { iniciais, corDoProfissional } from '@/lib/profissional';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Ban, CalendarDays, Plus, Clock } from 'lucide-react';

interface BoardAppointment {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  service_id?: string | null;
  service_name: string | null;
  status: string;
  scheduled_at: string;
  start_minutes: number;
  end_minutes: number;
  duration_minutes: number;
  /** Valor combinado do atendimento; sem combinado, o preco do servico. */
  price: number;
  /** true quando o barbeiro negociou um valor diferente do de tabela. */
  has_custom_price?: boolean;
}

interface BoardBlock {
  start_minutes: number;
  end_minutes: number;
  reason: string | null;
}

interface BoardWindow {
  start_minutes: number;
  end_minutes: number;
  start_time: string;
  end_time: string;
}

interface BoardColumn {
  professional_id: string;
  professional_name: string;
  role: string;
  windows: BoardWindow[];
  blocks: BoardBlock[];
  appointments: BoardAppointment[];
  summary: {
    appointments: number;
    booked_minutes: number;
    available_minutes: number;
  };
}

interface BoardResponse {
  date: string;
  weekday: number;
  day_start_minutes: number;
  day_end_minutes: number;
  columns: BoardColumn[];
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

/** Tamanho da fatia no celular quando nao da para deduzir dos servicos. */
const SLOT_PADRAO_MINUTOS = 30;

const minutesToLabel = (value: number) => {
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const todayISO = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const shiftDate = (iso: string, days: number) => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Cor do bloco conforme o status do agendamento. */
const statusStyles: Record<string, string> = {
  pendente: 'bg-amber-100 border-amber-400 text-amber-900',
  confirmado: 'bg-emerald-100 border-emerald-500 text-emerald-900',
  concluido: 'bg-sky-100 border-sky-500 text-sky-900',
  cancelado: 'bg-muted border-border text-muted-foreground line-through',
  no_show: 'bg-rose-100 border-rose-400 text-rose-900',
};

/** Uma fatia da agenda do dia: agendamento, bloqueio, livre ou fora do expediente. */
type Fatia =
  | { tipo: 'agendamento'; inicio: number; fim: number; agendamento: BoardAppointment }
  | { tipo: 'bloqueio'; inicio: number; fim: number; motivo: string | null }
  | { tipo: 'livre'; inicio: number; fim: number }
  | { tipo: 'fora'; inicio: number; fim: number };

interface AgendaBoardProps {
  /**
   * Chamado quando um agendamento e clicado. Recebe o registro completo da grade,
   * junto do nome do profissional, para a tela pai abrir a edicao sem precisar
   * procurar o item na listagem paginada.
   */
  onSelectAppointment?: (
    appointment: BoardAppointment & { professional_id: string; professional_name: string }
  ) => void;
  /**
   * Chamado quando um horario vazio e tocado e o usuario escolhe "Agendar".
   * Ja vem com barbeiro, data e hora resolvidos: o formulario abre faltando
   * so cliente e servico.
   */
  onCreateAppointment?: (slot: {
    professional_id: string;
    professional_name: string;
    scheduled_at: string;
  }) => void;
  /** Incrementar para forcar recarga externa (apos criar/editar um agendamento). */
  refreshToken?: number;
}

export const AgendaBoard: React.FC<AgendaBoardProps> = ({
  onSelectAppointment,
  onCreateAppointment,
  refreshToken = 0,
}) => {
  const isMobile = useIsMobile();
  const [date, setDate] = useState(todayISO());
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  /** No celular a agenda e de um barbeiro por vez; este e o escolhido. */
  const [barbeiroAtivoId, setBarbeiroAtivoId] = useState<string | null>(null);
  /** Fatia da agenda usada no celular, deduzida do menor servico ativo. */
  const [slotMinutos, setSlotMinutos] = useState(SLOT_PADRAO_MINUTOS);

  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockForm, setBlockForm] = useState({
    professional_id: '',
    start_time: '12:00',
    end_time: '13:00',
    reason: '',
    is_recurring: false,
  });

  /** Horario vazio que o usuario tocou. Abre o modal de acao rapida. */
  const [acaoSlot, setAcaoSlot] = useState<{
    professionalId: string;
    professionalName: string;
    inicio: number;
    fim: number;
  } | null>(null);
  const [bloqueandoRapido, setBloqueandoRapido] = useState(false);

  /** Caixa rolante da lista de horarios e a linha em que ela deve abrir. */
  const listaRef = useRef<HTMLDivElement>(null);
  const linhaFocoRef = useRef<HTMLElement | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const result = await companyService.getAgendaBoard({ date });
      setBoard(result);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar a agenda');
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard, refreshToken]);

  /**
   * Fatia do dia = menor servico ativo, limitada entre 10 e 60 minutos.
   * Barbearia que trabalha com corte de 20 minutos nao deve ver a agenda
   * quebrada de 30 em 30.
   */
  useEffect(() => {
    let ativo = true;
    companyService
      .list('appointment_services', { page: 1, pageSize: 100, is_active: 'true' })
      .then((resposta: any) => {
        if (!ativo) return;
        const duracoes = (resposta?.data || [])
          .map((item: any) => Number(item.durationMinutes ?? item.duration_minutes ?? 0))
          .filter((valor: number) => Number.isFinite(valor) && valor > 0);
        if (duracoes.length === 0) return;
        setSlotMinutos(Math.min(60, Math.max(10, Math.min(...duracoes))));
      })
      .catch(() => {
        // Sem a lista de servicos a fatia padrao de 30 min resolve.
      });
    return () => {
      ativo = false;
    };
  }, []);

  const columns = useMemo(() => board?.columns || [], [board]);

  // Mantem um barbeiro selecionado sempre que a lista muda de tamanho ou de dia.
  useEffect(() => {
    if (columns.length === 0) {
      setBarbeiroAtivoId(null);
      return;
    }
    setBarbeiroAtivoId((atual) =>
      atual && columns.some((column) => column.professional_id === atual)
        ? atual
        : columns[0].professional_id
    );
  }, [columns]);

  const indiceAtivo = Math.max(
    0,
    columns.findIndex((column) => column.professional_id === barbeiroAtivoId)
  );
  const colunaAtiva = columns[indiceAtivo] || null;

  const dayStart = board?.day_start_minutes ?? 8 * 60;
  const dayEnd = board?.day_end_minutes ?? 18 * 60;
  /**
   * Transforma janelas, bloqueios e agendamentos numa lista de fatias.
   *
   * No celular a grade posicional nao serve: um vazio de 15 minutos vira uma
   * faixa de 21px, pequena demais para o dedo. A lista da a cada fatia uma
   * altura confortavel e mantem a ordem do dia.
   */
  const fatiasDoDia = useCallback(
    (column: BoardColumn): Fatia[] => {
      const fatias: Fatia[] = [];
      const dentroDoExpediente = (minuto: number) =>
        column.windows.some((janela) => minuto >= janela.start_minutes && minuto < janela.end_minutes);

      let cursor = dayStart;
      let guarda = 0;

      while (cursor < dayEnd && guarda < 500) {
        guarda += 1;

        const agendamento = column.appointments.find(
          (item) => cursor >= item.start_minutes && cursor < item.end_minutes
        );
        if (agendamento) {
          fatias.push({
            tipo: 'agendamento',
            inicio: agendamento.start_minutes,
            fim: agendamento.end_minutes,
            agendamento,
          });
          cursor = Math.max(agendamento.end_minutes, cursor + 1);
          continue;
        }

        const bloqueio = column.blocks.find(
          (item) => cursor >= item.start_minutes && cursor < item.end_minutes
        );
        if (bloqueio) {
          fatias.push({
            tipo: 'bloqueio',
            inicio: bloqueio.start_minutes,
            fim: bloqueio.end_minutes,
            motivo: bloqueio.reason,
          });
          cursor = Math.max(bloqueio.end_minutes, cursor + 1);
          continue;
        }

        const fim = Math.min(cursor + slotMinutos, dayEnd);
        // O proximo compromisso pode comecar antes do fim da fatia cheia.
        const proximoInicio = Math.min(
          ...column.appointments
            .filter((item) => item.start_minutes > cursor)
            .map((item) => item.start_minutes),
          ...column.blocks
            .filter((item) => item.start_minutes > cursor)
            .map((item) => item.start_minutes),
          fim
        );

        fatias.push({
          tipo: dentroDoExpediente(cursor) ? 'livre' : 'fora',
          inicio: cursor,
          fim: proximoInicio,
        });
        cursor = Math.max(proximoInicio, cursor + 1);
      }

      return fatias;
    },
    [dayStart, dayEnd, slotMinutos]
  );

  /**
   * Em que minuto a lista deve abrir.
   *
   * A faixa da agenda vai das 7h as 22h — 30 linhas. Abrir sempre nas 7h joga
   * o comeco do expediente para fora da caixa e obriga a rolar toda vez. Hoje
   * abre na hora atual; outro dia, no primeiro compromisso.
   */
  const minutoFoco = useMemo(() => {
    if (!colunaAtiva) return dayStart;

    if (date === todayISO()) {
      const agora = new Date();
      const minutos = agora.getHours() * 60 + agora.getMinutes();
      if (minutos > dayStart && minutos < dayEnd) return minutos;
    }

    const primeiro = colunaAtiva.appointments
      .map((item) => item.start_minutes)
      .sort((a, b) => a - b)[0];
    return primeiro ?? dayStart;
  }, [colunaAtiva, date, dayStart, dayEnd]);

  // Posiciona a caixa sem mexer na rolagem da pagina — scrollIntoView levaria
  // a tela inteira junto.
  useEffect(() => {
    const caixa = listaRef.current;
    const linha = linhaFocoRef.current;
    if (!caixa || !linha) return;
    caixa.scrollTop = Math.max(0, linha.offsetTop - caixa.offsetTop);
  }, [board, barbeiroAtivoId, minutoFoco]);


  const openBlockDialog = (professionalId: string) => {
    setBlockForm({
      professional_id: professionalId,
      start_time: '12:00',
      end_time: '13:00',
      reason: '',
      is_recurring: false,
    });
    setBlockDialogOpen(true);
  };

  const handleSaveBlock = async () => {
    const { start_time: startTime, end_time: endTime } = blockForm;
    if (!startTime || !endTime) {
      toast.error('Informe o horario inicial e final');
      return;
    }
    if (endTime <= startTime) {
      toast.error('O horario final deve ser maior que o inicial');
      return;
    }

    setBlockSaving(true);
    try {
      const startAt = new Date(`${date}T${startTime}:00`);
      const endAt = new Date(`${date}T${endTime}:00`);

      if (blockForm.is_recurring) {
        // Recorrente: vale para esse dia da semana pelos proximos 12 meses.
        const vigenciaFim = new Date(`${date}T${endTime}:00`);
        vigenciaFim.setFullYear(vigenciaFim.getFullYear() + 1);
        await companyService.createAppointmentBlock({
          professional_id: blockForm.professional_id || undefined,
          start_at: startAt.toISOString(),
          end_at: vigenciaFim.toISOString(),
          reason: blockForm.reason || undefined,
          is_recurring: true,
          weekday: new Date(`${date}T12:00:00`).getDay(),
          start_time: startTime,
          end_time: endTime,
        });
      } else {
        await companyService.createAppointmentBlock({
          professional_id: blockForm.professional_id || undefined,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          reason: blockForm.reason || undefined,
        });
      }

      toast.success('Horario bloqueado');
      setBlockDialogOpen(false);
      await loadBoard();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao bloquear horario');
    } finally {
      setBlockSaving(false);
    }
  };

  /** Data e hora ISO local de uma fatia, no formato que o formulario espera. */
  const isoDoSlot = (minutos: number) => {
    const hora = String(Math.floor(minutos / 60)).padStart(2, '0');
    const minuto = String(Math.round(minutos % 60)).padStart(2, '0');
    return `${date}T${hora}:${minuto}`;
  };

  const abrirAcao = (column: BoardColumn, inicio: number, fim: number) => {
    setAcaoSlot({
      professionalId: column.professional_id,
      professionalName: column.professional_name,
      inicio,
      fim: Math.max(fim, inicio + slotMinutos),
    });
  };

  const confirmarAgendar = () => {
    if (!acaoSlot) return;
    onCreateAppointment?.({
      professional_id: acaoSlot.professionalId,
      professional_name: acaoSlot.professionalName,
      scheduled_at: isoDoSlot(acaoSlot.inicio),
    });
    setAcaoSlot(null);
  };

  /**
   * Bloqueia a fatia tocada na hora, sem pedir motivo.
   *
   * E a agilidade que a tela precisa ter: o barbeiro tem um compromisso e
   * bloqueia em dois toques. O desfazer no toast cobre o toque errado, e quem
   * quiser motivo ou recorrencia usa "Bloquear periodo".
   */
  const bloquearRapido = async () => {
    if (!acaoSlot) return;
    setBloqueandoRapido(true);
    try {
      const criado: any = await companyService.createAppointmentBlock({
        professional_id: acaoSlot.professionalId,
        start_at: new Date(`${isoDoSlot(acaoSlot.inicio)}:00`).toISOString(),
        end_at: new Date(`${isoDoSlot(acaoSlot.fim)}:00`).toISOString(),
      });

      const inicioLabel = minutesToLabel(acaoSlot.inicio);
      const fimLabel = minutesToLabel(acaoSlot.fim);
      setAcaoSlot(null);
      await loadBoard();

      toast.success(`Bloqueado das ${inicioLabel} as ${fimLabel}`, {
        action: criado?.id
          ? {
              label: 'Desfazer',
              onClick: async () => {
                try {
                  await companyService.deleteAppointmentBlock(criado.id);
                  toast.success('Bloqueio removido');
                  await loadBoard();
                } catch (error: any) {
                  toast.error(error?.message || 'Erro ao desfazer o bloqueio');
                }
              },
            }
          : undefined,
      });
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao bloquear horario');
    } finally {
      setBloqueandoRapido(false);
    }
  };

  // --- Arrastar para trocar de barbeiro (celular) ---
  const toqueRef = useRef<{ x: number; y: number } | null>(null);

  const aoTocar = (event: React.TouchEvent) => {
    const toque = event.touches[0];
    toqueRef.current = { x: toque.clientX, y: toque.clientY };
  };

  const aoSoltar = (event: React.TouchEvent) => {
    const inicio = toqueRef.current;
    toqueRef.current = null;
    if (!inicio || columns.length < 2) return;

    const fim = event.changedTouches[0];
    const dx = fim.clientX - inicio.x;
    const dy = fim.clientY - inicio.y;

    // So conta como troca de barbeiro se for claramente horizontal:
    // rolar a agenda na vertical nao pode mudar de coluna sem querer.
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return;

    const proximo = dx < 0 ? indiceAtivo + 1 : indiceAtivo - 1;
    if (proximo < 0 || proximo >= columns.length) return;
    setBarbeiroAtivoId(columns[proximo].professional_id);
  };

  const cabecalhoData = board
    ? `${WEEKDAYS[board.weekday]} - ${new Date(`${board.date}T12:00:00`).toLocaleDateString('pt-BR')}`
    : '';

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Agenda do dia
            </CardTitle>
            <CardDescription>
              Escolha o barbeiro acima e toque num horario para agendar ou bloquear.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
            />
            <Button variant="outline" size="icon" onClick={() => setDate(shiftDate(date, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => setDate(todayISO())}>
              Hoje
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">{cabecalhoData}</p>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando agenda...</p>
          ) : columns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum profissional ativo para exibir. Cadastre a equipe em Equipe.
            </p>
          ) : (
            /* Uma agenda por vez, em qualquer largura. Ver todos os barbeiros
               lado a lado so cabia no desktop e obrigava a apertar cada coluna;
               escolher de quem e a agenda ficou melhor nos dois tamanhos. */
            <div className="space-y-4">
              {/* Tira de barbeiros. O carrossel aqui e a escolha de quem, nao a agenda. */}
              <div className="-mx-2 flex gap-3 overflow-x-auto px-2 pb-2">
                {columns.map((column) => {
                  const ativo = column.professional_id === barbeiroAtivoId;
                  return (
                    <button
                      key={column.professional_id}
                      type="button"
                      onClick={() => setBarbeiroAtivoId(column.professional_id)}
                      aria-pressed={ativo}
                      className="flex w-16 shrink-0 flex-col items-center gap-1 focus-visible:outline-none"
                    >
                      <span
                        style={corDoProfissional(column.professional_id)}
                        className={`flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold transition ${
                          ativo
                            ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                            : 'opacity-60'
                        }`}
                      >
                        {iniciais(column.professional_name)}
                      </span>
                      <span
                        className={`w-full truncate text-center text-[11px] ${
                          ativo ? 'font-semibold text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {column.professional_name.split(' ')[0]}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {column.summary.appointments}
                      </span>
                    </button>
                  );
                })}
              </div>

              {colunaAtiva && (
                <div onTouchStart={aoTocar} onTouchEnd={aoSoltar} className="max-w-2xl space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{colunaAtiva.professional_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {colunaAtiva.summary.appointments} atendimentos
                        {columns.length > 1 && isMobile && ' - arraste para o proximo barbeiro'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBlockDialog(colunaAtiva.professional_id)}
                    >
                      <Ban className="mr-1.5 h-3.5 w-3.5" />
                      Bloquear periodo
                    </Button>
                  </div>

                  {colunaAtiva.windows.length === 0 ? (
                    <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Sem expediente neste dia.
                    </p>
                  ) : (
                    /* A agenda rola dentro da propria caixa. Das 7h as 22h sao
                       30 linhas: solta na pagina, empurrava a legenda, os
                       atalhos e o link publico para muito abaixo da dobra. */
                    <div
                      ref={listaRef}
                      className="max-h-[60vh] space-y-1.5 overflow-y-auto overscroll-contain pr-1 sm:max-h-[28rem]"
                    >
                      {fatiasDoDia(colunaAtiva).map((fatia, index, todas) => {
                        const chave = `${fatia.tipo}-${fatia.inicio}-${index}`;
                        const hora = minutesToLabel(fatia.inicio);
                        // Primeira fatia que alcanca o minuto de foco: e nela
                        // que a caixa abre.
                        const ehFoco =
                          fatia.fim > minutoFoco &&
                          !todas.slice(0, index).some((outra) => outra.fim > minutoFoco);
                        const refFoco = ehFoco
                          ? (node: HTMLElement | null) => {
                              linhaFocoRef.current = node;
                            }
                          : undefined;

                        if (fatia.tipo === 'agendamento') {
                          const tone =
                            statusStyles[fatia.agendamento.status] ||
                            'bg-primary/10 border-primary text-foreground';
                          return (
                            <button
                              key={chave}
                              ref={refFoco}
                              type="button"
                              onClick={() =>
                                onSelectAppointment?.({
                                  ...fatia.agendamento,
                                  professional_id: colunaAtiva.professional_id,
                                  professional_name: colunaAtiva.professional_name,
                                })
                              }
                              className={`flex w-full items-center gap-3 rounded-md border-l-4 px-3 py-2.5 text-left ${tone}`}
                            >
                              <span className="w-11 shrink-0 font-mono text-xs">{hora}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {fatia.agendamento.customer_name || (
                                    <span className="italic opacity-70">Sem cadastro</span>
                                  )}
                                </span>
                                <span className="block truncate text-xs opacity-80">
                                  {fatia.agendamento.service_name || 'Servico'} -{' '}
                                  {fatia.agendamento.duration_minutes} min
                                  {typeof fatia.agendamento.price === 'number'
                                    ? ` - ${fatia.agendamento.price.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL',
                                      })}`
                                    : ''}
                                </span>
                              </span>
                            </button>
                          );
                        }

                        if (fatia.tipo === 'bloqueio') {
                          return (
                            <div
                              key={chave}
                              ref={refFoco}
                              className="flex items-center gap-3 rounded-md border border-dashed border-destructive/50 bg-destructive/5 px-3 py-2.5"
                            >
                              <span className="w-11 shrink-0 font-mono text-xs text-muted-foreground">
                                {hora}
                              </span>
                              <span className="flex items-center gap-1.5 text-sm text-destructive">
                                <Ban className="h-3.5 w-3.5" />
                                {fatia.motivo || 'Bloqueado'}
                                <span className="text-xs opacity-70">
                                  ate {minutesToLabel(fatia.fim)}
                                </span>
                              </span>
                            </div>
                          );
                        }

                        if (fatia.tipo === 'fora') {
                          return (
                            <div
                              key={chave}
                              ref={refFoco}
                              className="flex items-center gap-3 px-3 py-1.5 opacity-45"
                            >
                              <span className="w-11 shrink-0 font-mono text-xs text-muted-foreground">
                                {hora}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Fora do expediente
                              </span>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={chave}
                            ref={refFoco}
                            type="button"
                            onClick={() => abrirAcao(colunaAtiva, fatia.inicio, fatia.fim)}
                            className="flex w-full items-center gap-3 rounded-md border border-dashed px-3 py-2.5 text-left transition hover:border-primary hover:bg-primary/5"
                          >
                            <span className="w-11 shrink-0 font-mono text-xs text-muted-foreground">
                              {hora}
                            </span>
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Plus className="h-3.5 w-3.5" />
                              Livre
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Legenda */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded border border-amber-400 bg-amber-100" />
              Pendente
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded border border-emerald-500 bg-emerald-100" />
              Confirmado
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded border border-sky-500 bg-sky-100" />
              Concluido
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded border border-destructive/50 bg-destructive/15" />
              Bloqueado
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Acao rapida do horario tocado: agendar ou bloquear, sem sair da agenda. */}
      <Dialog open={Boolean(acaoSlot)} onOpenChange={(aberto) => !aberto && setAcaoSlot(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {acaoSlot ? `${minutesToLabel(acaoSlot.inicio)} - ${acaoSlot.professionalName}` : ''}
            </DialogTitle>
            <DialogDescription>
              {cabecalhoData}
              {acaoSlot ? ` - ${acaoSlot.fim - acaoSlot.inicio} min` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Button onClick={confirmarAgendar} disabled={bloqueandoRapido} className="justify-start">
              <Plus className="mr-2 h-4 w-4" />
              Agendar horario
            </Button>
            <Button
              variant="outline"
              onClick={bloquearRapido}
              disabled={bloqueandoRapido}
              className="justify-start"
            >
              <Ban className="mr-2 h-4 w-4" />
              {bloqueandoRapido ? 'Bloqueando...' : 'Bloquear horario'}
            </Button>
            <p className="px-1 pt-1 text-xs text-muted-foreground">
              O bloqueio e gravado na hora. Da para desfazer no aviso que aparece em seguida.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear periodo</DialogTitle>
            <DialogDescription>
              O periodo bloqueado some da agenda: ninguem consegue marcar nele, nem pelo
              portal do cliente nem pelo link publico.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Das</Label>
                <Input
                  type="time"
                  value={blockForm.start_time}
                  onChange={(e) =>
                    setBlockForm((prev) => ({ ...prev, start_time: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Ate</Label>
                <Input
                  type="time"
                  value={blockForm.end_time}
                  onChange={(e) => setBlockForm((prev) => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input
                value={blockForm.reason}
                onChange={(e) => setBlockForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Almoco, medico, folga..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isRecurring"
                checked={blockForm.is_recurring}
                onCheckedChange={(checked) =>
                  setBlockForm((prev) => ({ ...prev, is_recurring: checked }))
                }
              />
              <Label htmlFor="isRecurring" className="cursor-pointer">
                Repetir toda {WEEKDAYS[new Date(`${date}T12:00:00`).getDay()].toLowerCase()}
              </Label>
            </div>
            {blockForm.is_recurring && (
              <p className="text-xs text-muted-foreground">
                O bloqueio passa a valer para esse dia da semana pelos proximos 12 meses.
                Use assim para o horario de almoco.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBlock} disabled={blockSaving}>
              {blockSaving ? 'Bloqueando...' : 'Bloquear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AgendaBoard;
