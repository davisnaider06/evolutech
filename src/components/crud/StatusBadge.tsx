import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}

const statusConfigs: Record<string, StatusConfig> = {
  // General
  active: { label: 'Ativo', variant: 'default', className: 'bg-green-500/20 text-green-600 border-green-500/30' },
  inactive: { label: 'Inativo', variant: 'secondary', className: 'bg-gray-500/20 text-gray-600 border-gray-500/30' },
  pending: { label: 'Pendente', variant: 'outline', className: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },

  // Appointments
  scheduled: { label: 'Pendente', variant: 'outline', className: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },
  pendente: { label: 'Pendente', variant: 'outline', className: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },
  confirmado: { label: 'Confirmado', variant: 'default', className: 'bg-blue-500/20 text-blue-600 border-blue-500/30' },
  cancelado: { label: 'Cancelado', variant: 'destructive', className: 'bg-red-500/20 text-red-600 border-red-500/30' },
  concluido: { label: 'Concluido', variant: 'default', className: 'bg-green-500/20 text-green-600 border-green-500/30' },
  no_show: { label: 'No-show', variant: 'secondary', className: 'bg-slate-500/20 text-slate-600 border-slate-500/30' },

  // Orders
  em_preparo: { label: 'Em Preparo', variant: 'outline', className: 'bg-orange-500/20 text-orange-600 border-orange-500/30' },
  pronto: { label: 'Pronto', variant: 'default', className: 'bg-purple-500/20 text-purple-600 border-purple-500/30' },
  entregue: { label: 'Entregue', variant: 'default', className: 'bg-green-500/20 text-green-600 border-green-500/30' },

  // Payment
  pago: { label: 'Pago', variant: 'default', className: 'bg-green-500/20 text-green-600 border-green-500/30' },
  parcial: { label: 'Parcial', variant: 'outline', className: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },
  vencido: { label: 'Vencido', variant: 'destructive', className: 'bg-red-500/20 text-red-600 border-red-500/30' },

  // Tickets
  aberto: { label: 'Aberto', variant: 'outline', className: 'bg-blue-500/20 text-blue-600 border-blue-500/30' },
  em_andamento: { label: 'Em Andamento', variant: 'outline', className: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30' },
  resolvido: { label: 'Resolvido', variant: 'default', className: 'bg-green-500/20 text-green-600 border-green-500/30' },
  fechado: { label: 'Fechado', variant: 'secondary', className: 'bg-gray-500/20 text-gray-600 border-gray-500/30' },
};

interface StatusBadgeProps {
  status: string;
  customLabels?: Record<string, string>;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, customLabels }) => {
  const config = statusConfigs[status] || {
    label: customLabels?.[status] || status,
    variant: 'outline' as const,
    className: '',
  };

  return (
    <Badge variant={config.variant} className={cn('font-medium', config.className)}>
      {customLabels?.[status] || config.label}
    </Badge>
  );
};
