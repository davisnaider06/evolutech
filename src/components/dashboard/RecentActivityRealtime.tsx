import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, User, Settings, Shield, LogIn, Trash2, Edit, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Activity {
  id: string;
  action: string;
  entity_type: string;
  user_email: string | null;
  created_at: string;
  details: any;
}

const actionConfig: Record<string, { icon: any; color: string; label: string }> = {
  create: { icon: Plus, color: 'text-green-500 bg-green-500/10', label: 'Criação' },
  update: { icon: Edit, color: 'text-blue-500 bg-blue-500/10', label: 'Atualização' },
  delete: { icon: Trash2, color: 'text-red-500 bg-red-500/10', label: 'Exclusão' },
  login: { icon: LogIn, color: 'text-purple-500 bg-purple-500/10', label: 'Login' },
  logout: { icon: LogIn, color: 'text-gray-500 bg-gray-500/10', label: 'Logout' },
  activate: { icon: Shield, color: 'text-green-500 bg-green-500/10', label: 'Ativação' },
  deactivate: { icon: Shield, color: 'text-amber-500 bg-amber-500/10', label: 'Desativação' },
  invite: { icon: User, color: 'text-cyan-500 bg-cyan-500/10', label: 'Convite' },
  role_change: { icon: Shield, color: 'text-orange-500 bg-orange-500/10', label: 'Mudança de Papel' },
};

const entityLabels: Record<string, string> = {
  company: 'Empresa',
  user: 'Usuário',
  payment_gateway: 'Gateway',
  module: 'Módulo',
  system: 'Sistema',
  ticket: 'Ticket',
  profile: 'Perfil',
};

export const RecentActivityRealtime: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
    } catch {
      return 'Data desconhecida';
    }
  };

  const getActionConfig = (action: string) => {
    return actionConfig[action] || { icon: Settings, color: 'text-gray-500 bg-gray-500/10', label: action };
  };

  const getDescription = (activity: Activity) => {
    const entity = entityLabels[activity.entity_type] || activity.entity_type;
    const config = getActionConfig(activity.action);
    return `${config.label} de ${entity}`;
  };

  if (loading) {
    return (
      <div className="glass rounded-xl p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-4 pb-4 border-b border-border last:border-0">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">Atividade Recente</h3>
      <div className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma atividade registrada</p>
          </div>
        ) : (
          activities.map((activity, index) => {
            const config = getActionConfig(activity.action);
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
                  <p className="text-sm font-medium">{getDescription(activity)}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{activity.user_email || 'Sistema'}</span>
                    <span>•</span>
                    <span>{formatTimestamp(activity.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
