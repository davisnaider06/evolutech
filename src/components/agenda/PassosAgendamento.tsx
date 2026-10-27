/**
 * Os quatro passos do agendamento do cliente — servico, barbeiro, dia e
 * horario — no visual do prototipo (design-references/image.png): servicos em
 * blocos com icone, como as "Categories"; barbeiros em lista com foto e nota,
 * como o "Nearby"; dias numa faixa de toque e horarios em pilulas.
 *
 * Usado pelo link publico (/agendar/:slug) e pelo portal do cliente, que
 * antes tinham cada um a sua copia do formulario.
 *
 * O que mudou para quem tem pouca intimidade com o celular:
 *  - o dia e uma faixa com "Hoje", "Amanha" e os proximos dias, no lugar do
 *    <input type="date"> (que no Android abre um calendario que muita gente
 *    fecha sem escolher nada);
 *  - escolhido um passo, a tela desce sozinha para o proximo;
 *  - barbearia com um barbeiro so nao pergunta quem vai atender.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Check, Clock, Crown, Droplets, Eye, Paintbrush, Scissors, Shuffle, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { corDoProfissional, iniciais } from '@/lib/profissional';
import { hojeNaBarbearia } from '@/lib/horario';
import { NotaCurta } from '@/components/avaliacao/Estrelas';
import { ProfissionalOpcao, QUALQUER_BARBEIRO } from '@/components/agenda/EscolhaProfissional';

export interface ServicoOpcao {
  id: string;
  name: string;
  duration_minutes?: number;
  price?: number;
}

export interface HorarioLivre {
  time: string;
  scheduled_at: string;
}

export interface EscolhaAgendamento {
  service_id: string;
  professional_id: string;
  date: string;
  scheduled_at: string;
}

export const ESCOLHA_VAZIA: EscolhaAgendamento = { service_id: '', professional_id: '', date: '', scheduled_at: '' };

interface Props {
  servicos: ServicoOpcao[];
  profissionais: ProfissionalOpcao[];
  valor: EscolhaAgendamento;
  onChange: (proximo: EscolhaAgendamento) => void;
  horarios: HorarioLivre[];
  carregandoHorarios: boolean;
  carregando?: boolean;
}

export const reais = (valor?: number) =>
  Number(valor || 0) > 0
    ? Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '';

/** Icone pelo nome do servico. Sem acerto, tesoura. */
export const iconeDoServico = (nome: string): React.ElementType => {
  const texto = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (texto.includes('+') || texto.includes('combo') || texto.includes('completo')) return Crown;
  if (texto.includes('barba')) return Paintbrush;
  if (texto.includes('sobrancelha')) return Eye;
  if (/(luzes|platin|pigment|tint|color|nevou)/.test(texto)) return Sparkles;
  if (/(hidrat|lavag|relax|progressiv|selag)/.test(texto)) return Droplets;
  return Scissors;
};

const DIAS_NA_FAIXA = 21;

/** Proximos dias a partir de hoje na barbearia, em "YYYY-MM-DD". */
const proximosDias = (inicio: string) => {
  const [ano, mes, dia] = inicio.split('-').map(Number);
  return Array.from({ length: DIAS_NA_FAIXA }).map((_, indice) => {
    // Conta em UTC: o dia e uma data de calendario, nao um instante.
    const data = new Date(Date.UTC(ano, mes - 1, dia + indice));
    const iso = data.toISOString().slice(0, 10);
    const semana = data.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
    return {
      iso,
      rotulo: indice === 0 ? 'Hoje' : indice === 1 ? 'Amanhã' : semana.charAt(0).toUpperCase() + semana.slice(1),
      numero: data.getUTCDate(),
      mes: data.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', ''),
    };
  });
};

const Passo: React.FC<{
  numero: number;
  titulo: string;
  feito?: boolean;
  children: React.ReactNode;
  secaoRef?: React.Ref<HTMLElement>;
}> = ({ numero, titulo, feito, children, secaoRef }) => (
  <section ref={secaoRef} className="scroll-mt-4 space-y-3">
    <h2 className="flex items-center gap-2 text-base font-semibold">
      <span
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
          feito ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
        )}
      >
        {feito ? <Check className="h-3.5 w-3.5" /> : numero}
      </span>
      {titulo}
    </h2>
    {children}
  </section>
);

const PassosAgendamento: React.FC<Props> = ({
  servicos,
  profissionais,
  valor,
  onChange,
  horarios,
  carregandoHorarios,
  carregando,
}) => {
  const refBarbeiro = useRef<HTMLElement>(null);
  const refDia = useRef<HTMLElement>(null);
  const refHorario = useRef<HTMLElement>(null);
  const dias = useMemo(() => proximosDias(hojeNaBarbearia()), []);
  const umBarbeiroSo = profissionais.length === 1;

  // Barbearia de um barbeiro so: ele ja vem escolhido.
  useEffect(() => {
    if (umBarbeiroSo && !valor.professional_id) {
      onChange({ ...valor, professional_id: profissionais[0].id, scheduled_at: '' });
    }
  }, [umBarbeiroSo, profissionais, valor, onChange]);

  const descer = (ref: React.RefObject<HTMLElement>) =>
    window.setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

  const escolherServico = (id: string) => {
    onChange({ ...valor, service_id: id, scheduled_at: '' });
    if (!valor.professional_id) descer(umBarbeiroSo ? refDia : refBarbeiro);
    else if (!valor.date) descer(refDia);
  };

  const escolherBarbeiro = (id: string) => {
    onChange({ ...valor, professional_id: id, scheduled_at: '' });
    descer(valor.date ? refHorario : refDia);
  };

  const escolherDia = (iso: string) => {
    onChange({ ...valor, date: iso, scheduled_at: '' });
    descer(refHorario);
  };

  if (carregando) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-20 animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
    );
  }

  const prontoParaHorario = Boolean(valor.service_id && valor.professional_id && valor.date);
  let passoDia = 3;
  if (umBarbeiroSo) passoDia = 2;

  return (
    <div className="space-y-7">
      <Passo numero={1} titulo="Qual serviço?" feito={Boolean(valor.service_id)}>
        {servicos.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            A barbearia ainda não cadastrou serviços para agendar online.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Serviço">
            {servicos.map((servico) => {
              const ativo = valor.service_id === servico.id;
              const Icone = iconeDoServico(servico.name);
              return (
                <button
                  key={servico.id}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => escolherServico(servico.id)}
                  className={cn(
                    'relative flex flex-col items-start gap-2 rounded-2xl border bg-card p-3 text-left shadow-card transition-all',
                    ativo ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-primary/40'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl',
                      ativo ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                    )}
                  >
                    <Icone className="h-5 w-5" />
                  </span>
                  <span className="line-clamp-2 text-sm font-semibold leading-tight">{servico.name}</span>
                  <span className="flex w-full items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{reais(servico.price)}</span>
                    {servico.duration_minutes ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {servico.duration_minutes} min
                      </span>
                    ) : null}
                  </span>
                  {ativo ? (
                    <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </Passo>

      {!umBarbeiroSo ? (
        <Passo numero={2} titulo="Com quem?" feito={Boolean(valor.professional_id)} secaoRef={refBarbeiro}>
          {profissionais.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum barbeiro disponível no momento.
            </p>
          ) : (
            <div className="space-y-2.5" role="radiogroup" aria-label="Barbeiro">
              <LinhaBarbeiro
                ativo={valor.professional_id === QUALQUER_BARBEIRO}
                onClick={() => escolherBarbeiro(QUALQUER_BARBEIRO)}
                foto={
                  <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Shuffle className="h-6 w-6" />
                  </span>
                }
                nome="Qualquer barbeiro"
                detalhe={<span className="text-xs font-medium text-emerald-600">Mais horários livres</span>}
              />
              {profissionais.map((profissional) => (
                <LinhaBarbeiro
                  key={profissional.id}
                  ativo={valor.professional_id === profissional.id}
                  onClick={() => escolherBarbeiro(profissional.id)}
                  foto={
                    <Avatar className="h-14 w-14 rounded-xl">
                      <AvatarImage
                        src={profissional.avatar_url || undefined}
                        alt={profissional.name}
                        className="object-cover"
                      />
                      <AvatarFallback
                        style={corDoProfissional(profissional.id)}
                        className="rounded-xl font-semibold"
                      >
                        {iniciais(profissional.name)}
                      </AvatarFallback>
                    </Avatar>
                  }
                  nome={profissional.name}
                  detalhe={
                    profissional.rating ? (
                      <NotaCurta rating={profissional.rating} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Barbeiro</span>
                    )
                  }
                />
              ))}
            </div>
          )}
        </Passo>
      ) : null}

      <Passo numero={passoDia} titulo="Que dia?" feito={Boolean(valor.date)} secaoRef={refDia}>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Dia">
          {dias.map((dia) => {
            const ativo = valor.date === dia.iso;
            return (
              <button
                key={dia.iso}
                type="button"
                role="radio"
                aria-checked={ativo}
                aria-label={`${dia.rotulo}, ${dia.numero} de ${dia.mes}`}
                onClick={() => escolherDia(dia.iso)}
                className={cn(
                  'flex h-[4.5rem] w-16 shrink-0 flex-col items-center justify-center rounded-2xl border text-center transition-colors',
                  ativo
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:border-primary/50'
                )}
              >
                <span className={cn('text-[11px] font-medium', ativo ? 'text-primary-foreground/90' : 'text-muted-foreground')}>
                  {dia.rotulo}
                </span>
                <span className="text-xl font-bold leading-tight">{dia.numero}</span>
                <span className={cn('text-[10px]', ativo ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {dia.mes}
                </span>
              </button>
            );
          })}
        </div>
      </Passo>

      <Passo numero={passoDia + 1} titulo="Que horas?" feito={Boolean(valor.scheduled_at)} secaoRef={refHorario}>
        {horarios.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Horários livres">
            {horarios.map((horario) => {
              const ativo = valor.scheduled_at === horario.scheduled_at;
              return (
                <button
                  key={horario.scheduled_at}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => onChange({ ...valor, scheduled_at: horario.scheduled_at })}
                  className={cn(
                    'h-11 rounded-full border text-sm font-semibold transition-colors',
                    ativo
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:border-primary/50'
                  )}
                >
                  {horario.time}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed px-4 py-4 text-sm text-muted-foreground">
            {!prontoParaHorario
              ? 'Escolha o serviço, o barbeiro e o dia para ver os horários livres.'
              : carregandoHorarios
                ? 'Procurando horários livres...'
                : 'Nenhum horário livre nesse dia. Toque em outro dia ou escolha "Qualquer barbeiro".'}
          </p>
        )}
      </Passo>
    </div>
  );
};

const LinhaBarbeiro: React.FC<{
  ativo: boolean;
  onClick: () => void;
  foto: React.ReactNode;
  nome: string;
  detalhe: React.ReactNode;
}> = ({ ativo, onClick, foto, nome, detalhe }) => (
  <button
    type="button"
    role="radio"
    aria-checked={ativo}
    onClick={onClick}
    className={cn(
      'flex w-full items-center gap-3 rounded-2xl border bg-card p-2.5 text-left shadow-card transition-all',
      ativo ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-primary/40'
    )}
  >
    {foto}
    <span className="min-w-0 flex-1">
      <span className="block truncate font-semibold">{nome}</span>
      <span className="mt-0.5 block">{detalhe}</span>
    </span>
    <span
      className={cn(
        'mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
        ativo ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
      )}
    >
      {ativo ? <Check className="h-3.5 w-3.5" /> : null}
    </span>
  </button>
);

export default PassosAgendamento;
