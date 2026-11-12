import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';

export interface DashboardActivityPoint {
  label: string;
  value: number;
}

interface DashboardActivityChartProps {
  data: DashboardActivityPoint[];
  loading?: boolean;
}

const chartConfig = { activity: { label: 'Atendimentos', color: 'hsl(var(--primary))' } };

export const DashboardActivityChart: React.FC<DashboardActivityChartProps> = ({ data, loading }) => {
  const hasActivity = data.some((point) => point.value > 0);

  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-card/90 p-4 shadow-card sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">Movimento do dia</h2>
          <p className="mt-1 text-xs text-muted-foreground">Atendimentos registrados por horário</p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500">Hoje</span>
      </div>

      {loading ? (
        <div role="status" aria-label="Carregando gráfico" className="esqueleto-vidro h-56 rounded-2xl" />
      ) : !hasActivity ? (
        <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 px-6 text-center">
          <span className="text-sm font-medium">Ainda não há atendimentos hoje</span>
          <span className="mt-1 text-xs text-muted-foreground">O movimento aparecerá aqui assim que a agenda começar.</span>
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-56 w-full aspect-auto sm:h-64">
          <BarChart data={data} margin={{ top: 10, right: 2, left: -22, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} fontSize={11} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tickMargin={8} fontSize={11} width={30} />
            <Tooltip
              cursor={{ fill: 'hsl(var(--primary) / 0.08)', radius: 16 }}
              contentStyle={{ borderRadius: 14, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }}
              formatter={(value: number) => [`${value} atendimento${value === 1 ? '' : 's'}`, 'Movimento']}
            />
            <Bar dataKey="value" radius={[18, 18, 18, 18]} maxBarSize={48}>
              {data.map((point) => <Cell key={point.label} fill="hsl(var(--primary))" fillOpacity={point.value ? 0.9 : 0.16} />)}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </section>
  );
};
