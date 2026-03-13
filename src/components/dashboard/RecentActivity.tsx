import React from 'react';
import { cn } from '@/lib/utils';
import { Building2, CalendarClock, ReceiptText, Settings, Shield, User } from 'lucide-react';

export interface RecentActivityItem {
  id: string;
  type: 'empresa' | 'usuario' | 'config' | 'seguranca' | 'agendamento' | 'pedido';
  description: string;
  timestamp: string;
  user: string;
}

const fallbackActivities: RecentActivityItem[] = [
  {
    id: 'fallback-1',
    type: 'empresa',
    description: 'Painel pronto para receber atividades reais do sistema',
    timestamp: 'Agora',
    user: 'Sistema',
  },
];

const typeConfig = {
  empresa: { icon: Building2, color: 'text-role-client-admin bg-role-client-admin/10' },
  usuario: { icon: User, color: 'text-role-admin-evolutech bg-role-admin-evolutech/10' },
  config: { icon: Settings, color: 'text-role-employee bg-role-employee/10' },
  seguranca: { icon: Shield, color: 'text-role-super-admin bg-role-super-admin/10' },
  agendamento: { icon: CalendarClock, color: 'text-sky-500 bg-sky-500/10' },
  pedido: { icon: ReceiptText, color: 'text-emerald-500 bg-emerald-500/10' },
};

export const RecentActivity: React.FC<{ items?: RecentActivityItem[]; title?: string }> = ({
  items,
  title = 'Atividade Recente',
}) => {
  const activities = items && items.length > 0 ? items : fallbackActivities;

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      <div className="space-y-4">
        {activities.map((activity, index) => {
          const config = typeConfig[activity.type] || typeConfig.config;
          const Icon = config.icon;

          return (
            <div
              key={activity.id}
              className={cn(
                'flex items-start gap-4 animate-fade-in',
                index !== activities.length - 1 && 'border-b border-border pb-4'
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', config.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{activity.description}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{activity.user}</span>
                  <span>•</span>
                  <span>{activity.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
