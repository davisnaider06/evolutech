import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MessageSquare, 
  AlertTriangle, 
  Clock,
  Building2,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Bell,
  Calendar,
  UserCheck,
  MessageCircle,
  Gift
} from 'lucide-react';

interface WhatsAppConfig {
  id: string;
  empresa_id: string;
  is_enabled: boolean;
  status: string;
  eventos_disponiveis: unknown;
  data_ativacao: string | null;
  motivo_desativacao: string | null;
  created_at: string;
  company?: {
    name: string;
  } | null;
}

interface DispatchLog {
  id: string;
  empresa_id: string;
  evento: string;
  telefone: string;
  status: string;
  created_at: string;
}

const EVENTOS_ICONS: Record<string, React.ReactNode> = {
  agendamento: <Calendar className="h-4 w-4" />,
  confirmacao: <CheckCircle2 className="h-4 w-4" />,
  cancelamento: <XCircle className="h-4 w-4" />,
  lembrete: <Bell className="h-4 w-4" />,
  boas_vindas: <Gift className="h-4 w-4" />,
};

const WhatsAppAutomacao: React.FC = () => {
  const { hasPermission } = useAuth();
  const [configs, setConfigs] = useState<WhatsAppConfig[]>([]);
  const [recentDispatches, setRecentDispatches] = useState<DispatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const isSuperAdmin = hasPermission(['SUPER_ADMIN_EVOLUTECH']);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch WhatsApp automation configs
      const { data: configData, error: configError } = await supabase
        .from('whatsapp_automation_config')
        .select(`
          *,
          company:companies(name)
        `)
        .order('created_at', { ascending: false });

      if (configError) throw configError;
      setConfigs(configData || []);

      // Fetch recent dispatches (últimos 50)
      const { data: dispatchData, error: dispatchError } = await supabase
        .from('whatsapp_dispatch')
        .select('id, empresa_id, evento, telefone, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (dispatchError) throw dispatchError;
      setRecentDispatches(dispatchData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      desativado: { variant: 'secondary', label: '🚫 Desativado' },
      pendente: { variant: 'outline', label: '⏳ Pendente' },
      ativo: { variant: 'default', label: '✅ Ativo' },
      suspenso: { variant: 'destructive', label: '⚠️ Suspenso' },
    };
    const config = statusConfig[status] || statusConfig.desativado;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredConfigs = configs.filter(c =>
    c.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-green-500" />
            Automação WhatsApp
          </h1>
          <p className="text-muted-foreground">
            Gerenciamento de automações de WhatsApp por empresa
          </p>
        </div>
      </div>

      {/* Warning Alert - Module Disabled */}
      <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <AlertTitle className="text-amber-600">Módulo em Preparação</AlertTitle>
        <AlertDescription className="text-amber-600/80">
          <p className="mb-2">
            A automação de WhatsApp <strong>ainda não está disponível</strong> para empresas clientes.
          </p>
          <p className="text-sm">
            Este módulo está sendo preparado estruturalmente. A ativação ocorrerá quando:
          </p>
          <ul className="list-disc list-inside text-sm mt-2 space-y-1">
            <li>API externa estiver configurada</li>
            <li>Webhooks estiverem estáveis</li>
            <li>Plano da empresa permitir</li>
            <li>Admin Evolutech liberar manualmente</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{configs.length}</p>
              <p className="text-sm text-muted-foreground">Empresas Configuradas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {configs.filter(c => c.status === 'ativo').length}
              </p>
              <p className="text-sm text-muted-foreground">Ativos</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {configs.filter(c => c.status === 'pendente').length}
              </p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{recentDispatches.length}</p>
              <p className="text-sm text-muted-foreground">Disparos Recentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar empresa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Configs Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Empresa Configs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Configurações por Empresa
              </CardTitle>
              <CardDescription>
                Status de cada empresa na automação WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredConfigs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma configuração encontrada
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    As configurações serão criadas automaticamente quando o módulo for ativado
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredConfigs.map((config) => (
                    <div
                      key={config.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                          <MessageSquare className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium">{config.company?.name || 'Empresa'}</p>
                          <p className="text-xs text-muted-foreground">
                            {Array.isArray(config.eventos_disponiveis) ? config.eventos_disponiveis.length : 0} eventos configurados
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(config.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Eventos Disponíveis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Eventos Disponíveis
              </CardTitle>
              <CardDescription>
                Tipos de eventos que podem ser automatizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { id: 'agendamento', nome: 'Agendamento', desc: 'Notifica quando um agendamento é criado' },
                  { id: 'confirmacao', nome: 'Confirmação', desc: 'Solicita confirmação de presença' },
                  { id: 'cancelamento', nome: 'Cancelamento', desc: 'Notifica sobre cancelamentos' },
                  { id: 'lembrete', nome: 'Lembrete', desc: 'Envia lembretes antes do horário' },
                  { id: 'boas_vindas', nome: 'Boas-vindas', desc: 'Mensagem para novos clientes' },
                ].map((evento) => (
                  <div
                    key={evento.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
                      {EVENTOS_ICONS[evento.id]}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{evento.nome}</p>
                      <p className="text-xs text-muted-foreground">{evento.desc}</p>
                    </div>
                    <Badge variant="outline">Preparado</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Dispatches Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Logs de Disparos Recentes
          </CardTitle>
          <CardDescription>
            Histórico dos últimos 50 disparos de mensagens
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentDispatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum disparo registrado</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {recentDispatches.map((dispatch) => (
                <div
                  key={dispatch.id}
                  className="flex items-center justify-between p-2 rounded border text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                      {EVENTOS_ICONS[dispatch.evento] || <MessageCircle className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium">{dispatch.evento}</p>
                      <p className="text-xs text-muted-foreground">
                        {dispatch.telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        dispatch.status === 'disparado' ? 'default' :
                        dispatch.status === 'erro' ? 'destructive' : 'secondary'
                      }
                    >
                      {dispatch.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(dispatch.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppAutomacao;
