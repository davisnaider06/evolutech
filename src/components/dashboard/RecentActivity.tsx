import React from 'react';
import { cn } from '@/lib/utils';
import { Building2, User, Settings, Shield } from 'lucide-react';

interface Activity {
  id: string;
  type: 'empresa' | 'usuario' | 'config' | 'seguranca';
  description: string;
  timestamp: string;
  user: string;
}

const activities: Activity[] = [
  {
    id: '1',
    type: 'empresa',
    description: 'Nova empresa "Tech Solutions" cadastrada',
    timestamp: 'Há 5 minutos',
    user: 'Admin Evolutech',
  },
  {
    id: '2',
    type: 'usuario',
    description: 'Novo funcionário adicionado à "Empresa XYZ"',
    timestamp: 'Há 15 minutos',
    user: 'João Silva',
  },
  {
    id: '3',
    type: 'seguranca',
    description: 'Permissões atualizadas para "Tech Solutions"',
    timestamp: 'Há 1 hora',
    user: 'Super Admin',
  },
  {
    id: '4',
    type: 'config',
    description: 'Configurações de email atualizadas',
    timestamp: 'Há 2 horas',
    user: 'Admin Evolutech',
  },
  {
    id: '5',
    type: 'empresa',
    description: 'Plano da "Startup ABC" atualizado para Enterprise',
    timestamp: 'Há 3 horas',
    user: 'Super Admin',
  },
];

const typeConfig = {
  empresa: { icon: Building2, color: 'text-role-client-admin bg-role-client-admin/10' },
  usuario: { icon: User, color: 'text-role-admin-evolutech bg-role-admin-evolutech/10' },
  config: { icon: Settings, color: 'text-role-employee bg-role-employee/10' },
  seguranca: { icon: Shield, color: 'text-role-super-admin bg-role-super-admin/10' },
};

export const RecentActivity: React.FC = () => {
  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">Atividade Recente</h3>
      <div className="space-y-4">
        {activities.map((activity, index) => {
          const config = typeConfig[activity.type];
          const Icon = config.icon;
          
          return (
            <div
              key={activity.id}
              className={cn(
                'flex items-start gap-4 animate-fade-in',
                index !== activities.length - 1 && 'pb-4 border-b border-border'
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', config.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
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
