import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AuditLog } from '@/types/auth';
import { 
  Search, 
  Filter,
  CalendarIcon,
  User,
  Building2,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  Power,
  Mail,
  Shield,
  Plus,
} from 'lucide-react';

const actionIcons: Record<string, React.ReactNode> = {
  create: <Plus className="h-4 w-4" />,
  update: <Pencil className="h-4 w-4" />,
  delete: <Trash2 className="h-4 w-4" />,
  login: <LogIn className="h-4 w-4" />,
  logout: <LogOut className="h-4 w-4" />,
  activate: <Power className="h-4 w-4" />,
  deactivate: <Power className="h-4 w-4" />,
  invite: <Mail className="h-4 w-4" />,
  role_change: <Shield className="h-4 w-4" />,
};

const actionLabels: Record<string, string> = {
  create: 'Criação',
  update: 'Atualização',
  delete: 'Exclusão',
  login: 'Login',
  logout: 'Logout',
  activate: 'Ativação',
  deactivate: 'Desativação',
  invite: 'Convite',
  role_change: 'Alteração de Role',
};

const actionColors: Record<string, string> = {
  create: 'bg-role-client-admin/20 text-role-client-admin border-role-client-admin/30',
  update: 'bg-role-admin-evolutech/20 text-role-admin-evolutech border-role-admin-evolutech/30',
  delete: 'bg-destructive/20 text-destructive border-destructive/30',
  login: 'bg-primary/20 text-primary border-primary/30',
  logout: 'bg-muted text-muted-foreground border-border',
  activate: 'bg-role-client-admin/20 text-role-client-admin border-role-client-admin/30',
  deactivate: 'bg-muted text-muted-foreground border-border',
  invite: 'bg-accent/20 text-accent border-accent/30',
  role_change: 'bg-role-super-admin/20 text-role-super-admin border-role-super-admin/30',
};

const Logs: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const fetchLogs = async () => {
    setIsLoading(true);
    
    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        profiles:user_id(full_name, email),
        companies:company_id(name)
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter as 'create' | 'update' | 'delete' | 'login' | 'logout' | 'activate' | 'deactivate' | 'invite' | 'role_change');
    }

    if (entityFilter !== 'all') {
      query = query.eq('entity_type', entityFilter);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom.toISOString());
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      setLogs((data as unknown as AuditLog[]) || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter, dateFrom, dateTo]);

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.user_email?.toLowerCase().includes(searchLower) ||
      log.entity_type?.toLowerCase().includes(searchLower) ||
      (log.profiles as { full_name?: string })?.full_name?.toLowerCase().includes(searchLower) ||
      (log.companies as { name?: string })?.name?.toLowerCase().includes(searchLower)
    );
  });

  const entityTypes = [...new Set(logs.map(l => l.entity_type))].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">Logs de Auditoria</h1>
        <p className="text-muted-foreground">
          Histórico de todas as ações realizadas no sistema
        </p>
      </div>

      {/* Filters */}
      <div className="glass rounded-lg p-4 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário, email, empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas ações</SelectItem>
                {Object.entries(actionLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo de entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas entidades</SelectItem>
                {entityTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {dateFrom ? format(dateFrom, 'dd/MM/yy', { locale: ptBR }) : 'De'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {dateTo ? format(dateTo, 'dd/MM/yy', { locale: ptBR }) : 'Até'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            {(actionFilter !== 'all' || entityFilter !== 'all' || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setActionFilter('all');
                  setEntityFilter('all');
                  setDateFrom(undefined);
                  setDateTo(undefined);
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredLogs.length} registros encontrados
      </div>

      {/* Logs List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="glass rounded-lg p-12 text-center">
            <p className="text-muted-foreground">Nenhum log encontrado</p>
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const profile = log.profiles as { full_name?: string; email?: string } | null;
            const company = log.companies as { name?: string } | null;
            
            return (
              <div
                key={log.id}
                className="glass rounded-lg p-4 animate-fade-in"
                style={{ animationDelay: `${Math.min(index * 20, 500)}ms` }}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
                      actionColors[log.action]?.split(' ')[0] || 'bg-muted'
                    )}>
                      {actionIcons[log.action] || <Filter className="h-4 w-4" />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn(actionColors[log.action])}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                        <span className="text-sm text-muted-foreground">em</span>
                        <Badge variant="secondary">{log.entity_type}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{profile?.full_name || log.user_email || 'Sistema'}</span>
                        {company?.name && (
                          <>
                            <Building2 className="h-3 w-3 text-muted-foreground ml-2" />
                            <span className="text-muted-foreground">{company.name}</span>
                          </>
                        )}
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {JSON.stringify(log.details)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground lg:text-right">
                    <div>{format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                    {log.ip_address && (
                      <div className="text-xs">IP: {log.ip_address}</div>
                    )}
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

export default Logs;
