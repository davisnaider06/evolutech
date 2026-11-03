/**
 * Avaliacoes dos atendimentos.
 *
 * Uma tela, dois conteudos: o backend decide pelo perfil. O dono recebe o
 * ranking e cada avaliacao com o cliente; o barbeiro recebe so a propria nota
 * e os comentarios, sem nada que identifique quem avaliou.
 */
import React, { useEffect, useState } from 'react';
import { EyeOff, MessageSquare, Star, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/crud/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Estrelas } from '@/components/avaliacao/Estrelas';
import { companyService } from '@/services/company';
import { corDoProfissional, iniciais } from '@/lib/profissional';
import { formatarDataHora } from '@/lib/horario';
import { cn } from '@/lib/utils';

type Distribuicao = Record<'1' | '2' | '3' | '4' | '5', number>;

interface ResumoDono {
  perfil: 'dono';
  media: number | null;
  total: number;
  distribuicao: Distribuicao;
  /** Nota da casa (ambiente, atendimento, pontualidade), separada dos cortes. */
  barbearia?: { media: number; total: number } | null;
  ranking: Array<{
    professional_id: string;
    name: string;
    avatar_url: string | null;
    media: number | null;
    total: number;
    media_30d: number | null;
    total_30d: number;
  }>;
  recentes: Array<{
    id: string;
    rating: number;
    rating_empresa?: number | null;
    comment: string | null;
    created_at: string;
    professional_name: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    service_name: string;
    scheduled_at: string;
  }>;
}

interface ResumoBarbeiro {
  perfil: 'barbeiro';
  media: number | null;
  total: number;
  distribuicao: Distribuicao;
  comentarios: Array<{ rating: number; comment: string }>;
}

const CartaoMedia: React.FC<{ media: number | null; total: number; distribuicao: Distribuicao; titulo: string }> = ({
  media,
  total,
  distribuicao,
  titulo,
}) => (
  <Card>
    <CardContent className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
      <div className="text-center sm:w-40">
        <p className="text-sm text-muted-foreground">{titulo}</p>
        <p className="text-5xl font-extrabold tabular-nums">{media !== null ? media.toFixed(1) : '–'}</p>
        <Estrelas nota={media || 0} tamanho="h-4 w-4" />
        <p className="mt-1 text-xs text-muted-foreground">
          {total} {total === 1 ? 'avaliação' : 'avaliações'}
        </p>
      </div>
      <div className="flex-1 space-y-1.5">
        {(['5', '4', '3', '2', '1'] as const).map((n) => {
          const qtd = distribuicao[n] || 0;
          const pct = total ? (qtd / total) * 100 : 0;
          return (
            <div key={n} className="flex items-center gap-2 text-sm">
              <span className="w-3 text-right tabular-nums text-muted-foreground">{n}</span>
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-right tabular-nums text-muted-foreground">{qtd}</span>
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>
);

const VisaoDono: React.FC<{ resumo: ResumoDono }> = ({ resumo }) => (
  <div className="space-y-5">
    <CartaoMedia titulo="Média dos cortes" media={resumo.media} total={resumo.total} distribuicao={resumo.distribuicao} />

    {/* A nota da casa fica a parte: espera, limpeza e recepcao nao sao culpa
        de quem cortou. */}
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <p className="text-4xl font-extrabold tabular-nums">
          {resumo.barbearia ? resumo.barbearia.media.toFixed(1) : '–'}
        </p>
        <div className="min-w-0">
          <p className="font-medium">Nota da barbearia</p>
          <Estrelas nota={resumo.barbearia?.media || 0} tamanho="h-4 w-4" />
          <p className="mt-1 text-xs text-muted-foreground">
            {resumo.barbearia
              ? `Ambiente, atendimento e pontualidade · ${resumo.barbearia.total} ${resumo.barbearia.total === 1 ? 'avaliação' : 'avaliações'}. Seus clientes veem a partir de 3.`
              : 'Ambiente, atendimento e pontualidade. Aparece quando os clientes começarem a avaliar.'}
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-amber-500" />
          Melhores barbeiros
        </CardTitle>
        <CardDescription>Cada barbeiro vê só a própria nota. O ranking é só seu.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {resumo.ranking.map((item, i) => (
          <div key={item.professional_id} className="flex items-center gap-3 rounded-lg border p-3">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                item.media !== null && i === 0 ? 'bg-amber-400 text-stone-950' : 'bg-muted text-muted-foreground',
              )}
            >
              {item.media !== null ? i + 1 : '–'}
            </span>
            <Avatar className="h-9 w-9">
              <AvatarImage src={item.avatar_url || undefined} alt={item.name} className="object-cover" />
              <AvatarFallback style={corDoProfissional(item.professional_id)} className="text-xs font-semibold">
                {iniciais(item.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.name}</p>
              {item.media !== null ? (
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <Estrelas nota={item.media} />
                  <span>
                    {item.media.toFixed(1)} · {item.total} {item.total === 1 ? 'avaliação' : 'avaliações'}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Ainda sem avaliações</p>
              )}
            </div>
            {item.media_30d !== null ? (
              <div className="hidden text-right text-xs text-muted-foreground sm:block">
                <p className="font-medium text-foreground">{item.media_30d.toFixed(1)}</p>
                <p>últimos 30 dias</p>
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Últimas avaliações
        </CardTitle>
        <CardDescription>Nota baixa? Aqui aparece quem foi, para você chamar o cliente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {resumo.recentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma avaliação ainda. O cliente recebe o pedido quando o atendimento é marcado como concluído.
          </p>
        ) : (
          resumo.recentes.map((r) => (
            <div key={r.id} className={cn('rounded-lg border p-3', (r.rating <= 2 || (r.rating_empresa ?? 5) <= 2) && 'border-destructive/40 bg-destructive/5')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    Corte <Estrelas nota={r.rating} />
                  </span>
                  {r.rating_empresa ? (
                    <span className="flex items-center gap-1">
                      Barbearia <Estrelas nota={r.rating_empresa} />
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">{formatarDataHora(r.created_at)}</span>
              </div>
              {r.comment ? <p className="mt-1.5 text-sm">“{r.comment}”</p> : null}
              <p className="mt-1.5 text-xs text-muted-foreground">
                {r.customer_name || 'Cliente'}
                {r.customer_phone ? ` · ${r.customer_phone}` : ''} · {r.service_name} com {r.professional_name || '—'}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  </div>
);

const VisaoBarbeiro: React.FC<{ resumo: ResumoBarbeiro }> = ({ resumo }) => (
  <div className="space-y-5">
    <CartaoMedia titulo="Sua nota" media={resumo.media} total={resumo.total} distribuicao={resumo.distribuicao} />
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">O que os clientes disseram</CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <EyeOff className="h-3.5 w-3.5" />
          Avaliações anônimas: não mostramos quem avaliou nem quando.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {resumo.comentarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>
        ) : (
          resumo.comentarios.map((c, i) => (
            <div key={i} className="rounded-lg border p-3">
              <Estrelas nota={c.rating} />
              <p className="mt-1.5 text-sm">“{c.comment}”</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  </div>
);

const Avaliacoes: React.FC = () => {
  const [resumo, setResumo] = useState<ResumoDono | ResumoBarbeiro | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    companyService
      .reviewsSummary()
      .then(setResumo)
      .catch((error: Error) => setErro(error.message || 'Não foi possível carregar as avaliações'));
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Avaliações"
        description={
          resumo?.perfil === 'barbeiro'
            ? 'Como os clientes avaliam o seu atendimento'
            : 'O que os clientes acham de cada atendimento'
        }
      />
      {erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : !resumo ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : resumo.perfil === 'dono' ? (
        <VisaoDono resumo={resumo} />
      ) : (
        <VisaoBarbeiro resumo={resumo} />
      )}
    </div>
  );
};

export default Avaliacoes;
