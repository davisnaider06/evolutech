import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, ArrowUpRight } from 'lucide-react';
import { adminService } from '@/services/admin';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Tenant {
  id: string;
  name: string;
  plan: 'starter' | 'professional' | 'enterprise';
  employees: number;
  status: string;
  updated_at: string;
  monthly_revenue: number;
}

const planColors = {
  starter: 'bg-muted text-muted-foreground',
  professional: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  enterprise: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
};

export const TenantsListRealtime: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const companies = await adminService.listarTenants();
      const top = (companies || []).slice(0, 5);
      setTenants(
        top.map((company: any) => ({
          id: company.id,
          name: company.name,
          plan: company.plan as 'starter' | 'professional' | 'enterprise',
          employees: company.owner ? 1 : 0,
          status: company.status,
          updated_at: company.updated_at,
          monthly_revenue: company.monthly_revenue || 0,
        }))
      );
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastActivity = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
    } catch {
      return 'Data desconhecida';
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/30 p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Empresas Recentes</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2"
          onClick={() => navigate('/admin-evolutech/empresas')}
        >
          Ver todas
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="space-y-3">
        {tenants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma empresa cadastrada</p>
          </div>
        ) : (
          tenants.map((tenant, index) => (
            <div
              key={tenant.id}
              className={cn(
                'flex items-center justify-between rounded-lg bg-secondary/30 p-4 transition-all duration-200 hover:bg-secondary/50 animate-fade-in cursor-pointer'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => navigate('/admin-evolutech/empresas')}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{tenant.name}</p>
                    {tenant.status !== 'active' && (
                      <span className="h-2 w-2 rounded-full bg-amber-500" title="Inativo" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{tenant.employees} usuários</span>
                    <span>•</span>
                    <span>{formatLastActivity(tenant.updated_at)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={cn('capitalize', planColors[tenant.plan])}>
                  {tenant.plan}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
