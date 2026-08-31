/**
 * O que aconteceu enquanto a pessoa esteve fora.
 *
 * E a rede de seguranca do push, nao um enfeite: no iPhone o aviso so chega
 * para quem instalou o app na tela de inicio, e nao da para contar com isso
 * na equipe inteira. Este painel aparece na abertura, sem depender de
 * permissao nenhuma, e mostra a mesma informacao.
 *
 * Carrega em silencio: enquanto busca nao ocupa espaco, e se a rede falhar
 * some da tela. Um erro aqui nao merece assustar ninguem — a agenda logo
 * abaixo continua sendo a fonte da verdade.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarClock, CircleAlert, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { companyService } from '@/services/company';

type Agendamento = {
  id: string;
  customer_name: string;
  service_name: string | null;
  professional_name: string | null;
  scheduled_at: string;
};

type Pendencias = {
  agendamentos_hoje: number;
  agendamentos_a_confirmar: number;
  agendamentos_novos: number;
  mensalidades_em_aberto: number;
  total: number;
  novos: Agendamento[];
  proximo: Agendamento | null;
};

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const PainelPendencias: React.FC = () => {
  const [dados, setDados] = useState<Pendencias | null>(null);
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await companyService.getPendencias());
    } catch (_erro) {
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  if (!dados) return null;

  const nadaParaMostrar =
    dados.agendamentos_hoje === 0 &&
    dados.agendamentos_novos === 0 &&
    dados.mensalidades_em_aberto === 0;

  if (nadaParaMostrar) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            Seu dia
          </CardTitle>
          <CardDescription>
            {dados.agendamentos_hoje === 0
              ? 'Nenhum horário marcado para hoje.'
              : `${dados.agendamentos_hoje} ${
                  dados.agendamentos_hoje === 1 ? 'horário marcado' : 'horários marcados'
                } para hoje.`}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={buscar}
          disabled={carregando}
          aria-label="Atualizar pendências"
        >
          <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {dados.proximo && (
          <button
            type="button"
            onClick={() => navigate('/empresa/agendamentos')}
            className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50"
          >
            <div>
              <p className="text-xs text-muted-foreground">Próximo</p>
              <p className="text-sm font-medium">{dados.proximo.customer_name}</p>
              <p className="text-xs text-muted-foreground">
                {dados.proximo.service_name || 'Serviço'}
                {dados.proximo.professional_name ? ` · ${dados.proximo.professional_name}` : ''}
              </p>
            </div>
            <span className="font-mono text-lg">{hora(dados.proximo.scheduled_at)}</span>
          </button>
        )}

        {dados.mensalidades_em_aberto > 0 && (
          <button
            type="button"
            onClick={() => navigate('/empresa/assinaturas')}
            className="flex w-full items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-left text-sm transition-colors hover:bg-amber-500/15"
          >
            <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>{dados.mensalidades_em_aberto}</strong>{' '}
              {dados.mensalidades_em_aberto === 1 ? 'mensalidade' : 'mensalidades'} aguardando
              sua confirmação
            </span>
          </button>
        )}

        {dados.novos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Entraram nas últimas 24h</p>
              <Badge variant="secondary">{dados.novos.length}</Badge>
            </div>
            <ul className="space-y-1.5">
              {dados.novos.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.customer_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.service_name || 'Serviço'}
                      {item.professional_name ? ` · ${item.professional_name}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {dataHora(item.scheduled_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
