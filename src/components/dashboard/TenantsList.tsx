import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Users, MoreVertical, ArrowUpRight } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  plan: 'starter' | 'professional' | 'enterprise';
  employees: number;
  isActive: boolean;
  lastActivity: string;
}

const tenants: Tenant[] = [
  { id: '1', name: 'Empresa XYZ', plan: 'enterprise', employees: 45, isActive: true, lastActivity: 'Há 5 min' },
  { id: '2', name: 'Tech Solutions', plan: 'professional', employees: 23, isActive: true, lastActivity: 'Há 1 hora' },
  { id: '3', name: 'Startup ABC', plan: 'starter', employees: 8, isActive: true, lastActivity: 'Há 2 horas' },
  { id: '4', name: 'Consultoria Digital', plan: 'professional', employees: 15, isActive: false, lastActivity: 'Há 3 dias' },
  { id: '5', name: 'Agência Criativa', plan: 'enterprise', employees: 32, isActive: true, lastActivity: 'Há 30 min' },
];

const planColors = {
  starter: 'bg-muted text-muted-foreground',
  professional: 'bg-role-admin-evolutech/20 text-role-admin-evolutech border-role-admin-evolutech/30',
  enterprise: 'bg-role-super-admin/20 text-role-super-admin border-role-super-admin/30',
};

export const TenantsList: React.FC = () => {
  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Empresas Recentes</h3>
        <Button variant="ghost" size="sm" className="gap-2">
          Ver todas
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="space-y-3">
        {tenants.map((tenant, index) => (
          <div
            key={tenant.id}
            className={cn(
              'flex items-center justify-between rounded-lg bg-secondary/30 p-4 transition-all duration-200 hover:bg-secondary/50 animate-fade-in'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{tenant.name}</p>
                  {!tenant.isActive && (
                    <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{tenant.employees} funcionários</span>
                  <span>•</span>
                  <span>{tenant.lastActivity}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={cn('capitalize', planColors[tenant.plan])}>
                {tenant.plan}
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
