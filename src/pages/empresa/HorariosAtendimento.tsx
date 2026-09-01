import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/crud/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Clock, CopyCheck, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { companyService } from '@/services/company';
import { appointmentsService } from '@/services/appointments';

interface DiaJornada {
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface ProfissionalOption {
  id: string;
  name: string;
}

const DIAS = [
  { value: 1, label: 'Segunda-feira', curto: 'Seg' },
  { value: 2, label: 'Terca-feira', curto: 'Ter' },
  { value: 3, label: 'Quarta-feira', curto: 'Qua' },
  { value: 4, label: 'Quinta-feira', curto: 'Qui' },
  { value: 5, label: 'Sexta-feira', curto: 'Sex' },
  { value: 6, label: 'Sabado', curto: 'Sab' },
  { value: 0, label: 'Domingo', curto: 'Dom' },
];

const ABERTURA_PADRAO = '09:00';
const FECHAMENTO_PADRAO = '18:00';

/** Dia sem registro no banco nasce como folga: nao inventa expediente. */
const jornadaVazia = (): DiaJornada[] =>
  DIAS.map((dia) => ({
    weekday: dia.value,
    start_time: ABERTURA_PADRAO,
    end_time: FECHAMENTO_PADRAO,
    is_active: false,
  }));

const paraMinutos = (hora: string) => {
  const [h, m] = String(hora || '').split(':');
  return Number(h || 0) * 60 + Number(m || 0);
};

const HorariosAtendimento: React.FC = () => {
  const { user, company } = useAuth();
  const bookingSlug = user?.tenantSlug || company?.slug;
  const isOwner = user?.role === 'DONO_EMPRESA';

  const [profissionais, setProfissionais] = useState<ProfissionalOption[]>([]);
  const [profissionalId, setProfissionalId] = useState('');
  const [jornada, setJornada] = useState<DiaJornada[]>(jornadaVazia);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregarProfissionais = useCallback(async () => {
    if (!bookingSlug) return;
    try {
      const options = await appointmentsService.getPublicBookingOptions(bookingSlug);
      const lista: ProfissionalOption[] = Array.isArray(options?.professionals)
        ? options.professionals
        : [];
      setProfissionais(lista);

      // Funcionario so mexe na propria jornada — o backend impoe isso de
      // qualquer forma, aqui e so para a tela ja abrir no lugar certo.
      setProfissionalId((atual) => {
        if (atual) return atual;
        if (!isOwner) return user?.id || lista[0]?.id || '';
        return lista[0]?.id || '';
      });
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar profissionais');
    }
  }, [bookingSlug, isOwner, user?.id]);

  const carregarJornada = useCallback(async () => {
    if (!profissionalId) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    try {
      const linhas = await companyService.listAppointmentAvailability(profissionalId);
      const salvos = new Map<number, DiaJornada>();
      (Array.isArray(linhas) ? linhas : []).forEach((linha: any) => {
        salvos.set(Number(linha.weekday), {
          weekday: Number(linha.weekday),
          start_time: String(linha.start_time || ABERTURA_PADRAO).slice(0, 5),
          end_time: String(linha.end_time || FECHAMENTO_PADRAO).slice(0, 5),
          is_active: linha.is_active !== false,
        });
      });
      setJornada(
        DIAS.map(
          (dia) =>
            salvos.get(dia.value) || {
              weekday: dia.value,
              start_time: ABERTURA_PADRAO,
              end_time: FECHAMENTO_PADRAO,
              is_active: false,
            }
        )
      );
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar os horarios');
    } finally {
      setCarregando(false);
    }
  }, [profissionalId]);

  useEffect(() => {
    carregarProfissionais();
  }, [carregarProfissionais]);

  useEffect(() => {
    carregarJornada();
  }, [carregarJornada]);

  const alterarDia = (weekday: number, mudanca: Partial<DiaJornada>) => {
    setJornada((atual) =>
      atual.map((dia) => (dia.weekday === weekday ? { ...dia, ...mudanca } : dia))
    );
  };

  /** Copia a faixa de horario de um dia para todos os outros dias que atendem. */
  const replicarParaTodos = (weekday: number) => {
    const modelo = jornada.find((dia) => dia.weekday === weekday);
    if (!modelo) return;
    setJornada((atual) =>
      atual.map((dia) =>
        dia.is_active
          ? { ...dia, start_time: modelo.start_time, end_time: modelo.end_time }
          : dia
      )
    );
    toast.success(`Horario de ${modelo.start_time} as ${modelo.end_time} aplicado aos dias que voce atende`);
  };

  const diasAtivos = useMemo(() => jornada.filter((dia) => dia.is_active), [jornada]);

  const resumo = useMemo(() => {
    if (diasAtivos.length === 0) return 'Nenhum dia de atendimento marcado.';
    return diasAtivos
      .map((dia) => {
        const nome = DIAS.find((item) => item.value === dia.weekday)?.curto || '';
        return `${nome} ${dia.start_time}-${dia.end_time}`;
      })
      .join(' · ');
  }, [diasAtivos]);

  const salvar = async () => {
    if (!profissionalId) {
      toast.error('Selecione um profissional');
      return;
    }

    const invalido = diasAtivos.find(
      (dia) => paraMinutos(dia.end_time) <= paraMinutos(dia.start_time)
    );
    if (invalido) {
      const nome = DIAS.find((item) => item.value === invalido.weekday)?.label;
      toast.error(`Em ${nome}, o horario de fim precisa ser depois do de inicio`);
      return;
    }

    setSalvando(true);
    try {
      // Manda a semana inteira, inclusive as folgas: e assim que um dia
      // desmarcado deixa de valer no link publico.
      await companyService.saveAppointmentAvailability(profissionalId, jornada);
      toast.success('Horarios salvos');
      carregarJornada();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar os horarios');
    } finally {
      setSalvando(false);
    }
  };

  const nomeSelecionado =
    profissionais.find((item) => item.id === profissionalId)?.name || user?.name || '';

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <PageHeader
        title="Horarios de atendimento"
        description="Defina, para cada profissional, os dias e as faixas de horario em que ele aceita agendamento."
        showButton={false}
      />

      {isOwner && profissionais.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Profissional</CardTitle>
            <CardDescription>Escolha de quem voce quer ajustar a jornada.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Chips em vez de <select>: no celular a lista inteira fica a um
                toque, sem abrir o seletor nativo do sistema. */}
            <div className="flex flex-wrap gap-2">
              {profissionais.map((profissional) => (
                <button
                  key={profissional.id}
                  type="button"
                  onClick={() => setProfissionalId(profissional.id)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm transition-colors',
                    profissional.id === profissionalId
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-muted'
                  )}
                >
                  {profissional.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            Semana de {nomeSelecionado || 'atendimento'}
          </CardTitle>
          <CardDescription>
            Desligue o dia para marcar folga. O cliente so consegue escolher horarios
            dentro das faixas ligadas aqui.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando horarios...</p>
          ) : (
            <>
              {jornada.map((dia) => {
                const info = DIAS.find((item) => item.value === dia.weekday);
                return (
                  <div
                    key={dia.weekday}
                    className={cn(
                      'rounded-lg border p-3 transition-colors',
                      dia.is_active ? 'bg-card' : 'bg-muted/40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{info?.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {dia.is_active
                            ? `Atende das ${dia.start_time} as ${dia.end_time}`
                            : 'Folga'}
                        </p>
                      </div>
                      <Switch
                        checked={dia.is_active}
                        onCheckedChange={(marcado) =>
                          alterarDia(dia.weekday, { is_active: marcado })
                        }
                        aria-label={`Atender ${info?.label}`}
                      />
                    </div>

                    {dia.is_active && (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs" htmlFor={`inicio-${dia.weekday}`}>
                              Comeca as
                            </Label>
                            <Input
                              id={`inicio-${dia.weekday}`}
                              type="time"
                              value={dia.start_time}
                              onChange={(e) =>
                                alterarDia(dia.weekday, { start_time: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs" htmlFor={`fim-${dia.weekday}`}>
                              Termina as
                            </Label>
                            <Input
                              id={`fim-${dia.weekday}`}
                              type="time"
                              value={dia.end_time}
                              onChange={(e) =>
                                alterarDia(dia.weekday, { end_time: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-2 px-2 text-xs"
                          onClick={() => replicarParaTodos(dia.weekday)}
                        >
                          <CopyCheck className="h-3.5 w-3.5" />
                          Usar este horario nos outros dias
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              <p className="pt-1 text-xs text-muted-foreground">{resumo}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* No celular a semana toda nao cabe na tela; o botao acompanha a rolagem
          para nao ser preciso voltar ao topo depois de mexer no domingo. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-4 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="flex justify-end lg:mx-0">
          <Button
            onClick={salvar}
            disabled={salvando || carregando || !profissionalId}
            className="w-full gap-2 lg:w-auto"
          >
            {salvando ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {salvando ? 'Salvando...' : 'Salvar horarios'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HorariosAtendimento;
