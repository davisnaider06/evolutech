import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Ban, CalendarDays } from 'lucide-react';

interface BoardAppointment {
  id: string;
  customer_id: string | null;
  customer_name: string;
  service_name: string | null;
  status: string;
  scheduled_at: string;
  start_minutes: number;
  end_minutes: number;
  duration_minutes: number;
  price: number;
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

/** Altura de um minuto na grade, em pixels. 1.4 deixa um corte de 30 min com 42px. */
const PIXELS_PER_MINUTE = 1.4;
/** De quanto em quanto tempo desenhar a regua da esquerda. */
const RULER_STEP_MINUTES = 30;

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

interface AgendaBoardProps {
  /**
   * Chamado quando um agendamento e clicado. Recebe o registro completo da grade,
   * junto do nome do profissional, para a tela pai abrir a edicao sem precisar
   * procurar o item na listagem paginada.
   */
  onSelectAppointment?: (
    appointment: BoardAppointment & { professional_id: string; professional_name: string }
  ) => void;
  /** Incrementar para forcar recarga externa (apos criar/editar um agendamento). */
  refreshToken?: number;
}

export const AgendaBoard: React.FC<AgendaBoardProps> = ({
  onSelectAppointment,
  refreshToken = 0,
}) => {
  const [date, setDate] = useState(todayISO());
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockForm, setBlockForm] = useState({
    professional_id: '',
    start_time: '12:00',
    end_time: '13:00',
    reason: '',
    is_recurring: false,
  });

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

  const dayStart = board?.day_start_minutes ?? 8 * 60;
  const dayEnd = board?.day_end_minutes ?? 18 * 60;
  const totalMinutes = Math.max(60, dayEnd - dayStart);
  const gridHeight = totalMinutes * PIXELS_PER_MINUTE;

  /** Marcas da regua horaria a esquerda. */
  const ruler = useMemo(() => {
    const marks: number[] = [];
    const first = Math.ceil(dayStart / RULER_STEP_MINUTES) * RULER_STEP_MINUTES;
    for (let cursor = first; cursor <= dayEnd; cursor += RULER_STEP_MINUTES) {
      marks.push(cursor);
    }
    return marks;
  }, [dayStart, dayEnd]);

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

  const columns = board?.columns || [];

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
              Uma coluna por barbeiro. Clique num atendimento para abrir, ou bloqueie um
              horario para almoco e folga.
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
          <p className="mb-3 text-sm text-muted-foreground">
            {board ? WEEKDAYS[board.weekday] : ''}
            {board ? ` - ${new Date(`${board.date}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}
          </p>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando agenda...</p>
          ) : columns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum profissional ativo para exibir. Cadastre a equipe em Equipe.
            </p>
          ) : (
            // A grade rola na horizontal quando ha muitos barbeiros.
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {/* Regua de horarios */}
                <div className="w-16 shrink-0 pt-12">
                  <div className="relative" style={{ height: gridHeight }}>
                    {ruler.map((mark) => (
                      <div
                        key={mark}
                        className="absolute left-0 w-full pr-2 text-right text-xs text-muted-foreground"
                        style={{ top: (mark - dayStart) * PIXELS_PER_MINUTE - 8 }}
                      >
                        {minutesToLabel(mark)}
                      </div>
                    ))}
                  </div>
                </div>

                {columns.map((column) => {
                  const ocupacao =
                    column.summary.available_minutes > 0
                      ? Math.round(
                          (column.summary.booked_minutes / column.summary.available_minutes) * 100
                        )
                      : 0;

                  return (
                    <div key={column.professional_id} className="w-56 shrink-0">
                      {/* Cabecalho da coluna */}
                      <div className="mb-2 h-12 rounded-t border-b bg-muted/50 px-2 py-1">
                        <p className="truncate text-sm font-medium">{column.professional_name}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {column.summary.appointments} atend. - {ocupacao}% ocupado
                          </span>
                          <button
                            type="button"
                            title="Bloquear horario"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => openBlockDialog(column.professional_id)}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Corpo da coluna */}
                      <div
                        className="relative rounded border bg-background"
                        style={{ height: gridHeight }}
                      >
                        {/* Linhas da regua */}
                        {ruler.map((mark) => (
                          <div
                            key={mark}
                            className="absolute left-0 w-full border-t border-dashed border-border/60"
                            style={{ top: (mark - dayStart) * PIXELS_PER_MINUTE }}
                          />
                        ))}

                        {/* Janela de trabalho: o que esta fora fica apagado */}
                        {column.windows.map((window, index) => (
                          <div
                            key={`w-${index}`}
                            className="absolute left-0 w-full bg-emerald-50/40"
                            style={{
                              top: (window.start_minutes - dayStart) * PIXELS_PER_MINUTE,
                              height:
                                (window.end_minutes - window.start_minutes) * PIXELS_PER_MINUTE,
                            }}
                          />
                        ))}

                        {column.windows.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-muted-foreground">
                            Sem expediente neste dia
                          </div>
                        )}

                        {/* Bloqueios */}
                        {column.blocks.map((block, index) => (
                          <div
                            key={`b-${index}`}
                            title={block.reason || 'Horario bloqueado'}
                            className="absolute left-0 w-full border-y border-dashed border-destructive/50 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(239,68,68,0.15)_6px,rgba(239,68,68,0.15)_12px)] px-1"
                            style={{
                              top: (block.start_minutes - dayStart) * PIXELS_PER_MINUTE,
                              height:
                                (block.end_minutes - block.start_minutes) * PIXELS_PER_MINUTE,
                            }}
                          >
                            <span className="text-[10px] font-medium text-destructive">
                              {block.reason || 'Bloqueado'}
                            </span>
                          </div>
                        ))}

                        {/* Agendamentos */}
                        {column.appointments.map((appointment) => {
                          const tone =
                            statusStyles[appointment.status] ||
                            'bg-primary/10 border-primary text-foreground';
                          const height = Math.max(
                            22,
                            appointment.duration_minutes * PIXELS_PER_MINUTE - 2
                          );
                          return (
                            <button
                              key={appointment.id}
                              type="button"
                              onClick={() =>
                                onSelectAppointment?.({
                                  ...appointment,
                                  professional_id: column.professional_id,
                                  professional_name: column.professional_name,
                                })
                              }
                              className={`absolute left-1 right-1 overflow-hidden rounded border-l-4 px-1.5 py-0.5 text-left text-xs shadow-sm transition hover:shadow ${tone}`}
                              style={{
                                top:
                                  (appointment.start_minutes - dayStart) * PIXELS_PER_MINUTE + 1,
                                height,
                              }}
                            >
                              <span className="block truncate font-medium">
                                {minutesToLabel(appointment.start_minutes)}{' '}
                                {appointment.customer_name}
                              </span>
                              {height > 32 && (
                                <span className="block truncate opacity-80">
                                  {appointment.service_name || 'Servico'}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
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

      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear horario</DialogTitle>
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
