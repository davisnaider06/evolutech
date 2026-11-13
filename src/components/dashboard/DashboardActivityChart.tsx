import React from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { BadgeTendencia } from '@/components/visual/BadgeTendencia';
import { BarraComPonto, TooltipGrafico } from '@/components/visual/TooltipGrafico';

export interface DashboardActivityPoint {
  label: string;
  value: number;
}

interface DashboardActivityChartProps {
  data: DashboardActivityPoint[];
  loading?: boolean;
  period?: 'Hoje' | 'Semana' | 'Mês';
}

const chartConfig = { activity: { label: 'Atendimentos', color: 'hsl(var(--primary))' } };

const EIXO = { fill: 'hsl(var(--muted-foreground))', fontSize: 12 };

/**
 * Barras em capsula (pontas redondas) na cor primaria, cada uma sobre um
 * trilho cinza de altura total. Grade tracejada discreta e tooltip em card.
 */
export const DashboardActivityChart: React.FC<DashboardActivityChartProps> = ({ data, loading }) => {
  const total = data.reduce((soma, ponto) => soma + ponto.value, 0);
  const hasActivity = total > 0;

  return (
    <section className="overflow-hidden rounded-card bg-card p-card-pad text-card-foreground shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-secao">Movimento do dia</h2>
        {!loading && hasActivity && (
          <BadgeTendencia tendencia="alta">
            {total} atendimento{total === 1 ? '' : 's'}
          </BadgeTendencia>
        )}
      </div>

      {loading ? (
        <div role="status" aria-label="Carregando gráfico" className="esqueleto-vidro h-60 rounded-2xl" />
      ) : !hasActivity ? (
        <div className="flex h-60 flex-col items-center justify-center rounded-2xl bg-muted/60 px-6 text-center">
          <span className="text-rotulo font-medium">Ainda não há atendimentos hoje</span>
          <span className="mt-1 text-legenda text-muted-foreground">O movimento aparecerá aqui assim que a agenda começar.</span>
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full sm:h-64">
          <BarChart data={data} margin={{ top: 8, right: 0, left: -18, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} tick={EIXO} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tickMargin={8} tick={EIXO} width={30} />
            <Tooltip
              cursor={false}
              content={
                <TooltipGrafico formatar={(valor) => `Atendimentos: ${valor}`} />
              }
            />
            <Bar
              dataKey="value"
              fill="hsl(var(--primary))"
              radius={999}
              maxBarSize={44}
              background={{ fill: 'hsl(var(--muted))', radius: 999 }}
              activeBar={<BarraComPonto />}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      )}
    </section>
  );
};
