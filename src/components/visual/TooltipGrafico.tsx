import React from 'react';

interface TooltipGraficoProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ value?: number | string }>;
  /** Monta o texto do valor, ex.: (5) => "Atendimentos: 5". */
  formatar: (valor: number) => React.ReactNode;
}

/** Card branco flutuante do grafico: horario em cinza, valor em peso 600. */
export const TooltipGrafico: React.FC<TooltipGraficoProps> = ({ active, label, payload, formatar }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-tooltip bg-popover px-3 py-2 text-popover-foreground shadow-float">
      <p className="text-legenda text-muted-foreground">{label}</p>
      <p className="text-rotulo font-semibold">{formatar(Number(payload[0].value ?? 0))}</p>
    </div>
  );
};

/** Barra ativa: a mesma capsula, com um ponto marcando o topo. */
export const BarraComPonto: React.FC<{ x?: number; y?: number; width?: number; height?: number; fill?: string }> = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill,
}) => {
  const raio = Math.min(width / 2, height / 2);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={raio} ry={raio} fill={fill} />
      <circle cx={x + width / 2} cy={y + Math.min(8, height / 2)} r={4} fill="hsl(var(--card))" stroke={fill} strokeWidth={2} />
    </g>
  );
};
