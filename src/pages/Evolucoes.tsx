import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Rocket, Code, Bug, Sparkles, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Evolucao {
  id: string;
  sistema_base_id: string | null;
  empresa_id: string | null;
  titulo: string;
  descricao: string;
  tipo: 'melhoria' | 'correcao' | 'nova_funcionalidade' | 'customizacao';
  status: 'pendente' | 'em_desenvolvimento' | 'em_teste' | 'concluido' | 'cancelado';
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  versao_alvo: string | null;
  created_at: string;
}

const tipoIcons = {
  melhoria: Sparkles,
  correcao: Bug,
  nova_funcionalidade: Code,
  customizacao: Wrench,
};

const tipoLabels = {
  melhoria: 'Melhoria',
  correcao: 'Correção',
  nova_funcionalidade: 'Nova Funcionalidade',
  customizacao: 'Customização',
};

const statusColors = {
  pendente: 'bg-yellow-500/20 text-yellow-500',
  em_desenvolvimento: 'bg-blue-500/20 text-blue-500',
  em_teste: 'bg-purple-500/20 text-purple-500',
  concluido: 'bg-green-500/20 text-green-500',
  cancelado: 'bg-red-500/20 text-red-500',
};

const statusLabels = {
  pendente: 'Pendente',
  em_desenvolvimento: 'Em Desenvolvimento',
  em_teste: 'Em Teste',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const prioridadeColors = {
  baixa: 'bg-green-500/20 text-green-500',
  media: 'bg-yellow-500/20 text-yellow-500',
  alta: 'bg-orange-500/20 text-orange-500',
  critica: 'bg-red-500/20 text-red-500',
};

export default function Evolucoes() {
  const { user } = useAuth();
  const { logAudit } = useAuditLog();
  const { toast } = useToast();
  const [evolucoes, setEvolucoes] = useState<Evolucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo: 'melhoria' as const,
    prioridade: 'media' as const,
  });

  const isEvolutech = user?.role === 'SUPER_ADMIN_EVOLUTECH' || user?.role === 'ADMIN_EVOLUTECH';

  useEffect(() => {
    fetchEvolucoes();
  }, []);

  const fetchEvolucoes = async () => {
    const { data, error } = await supabase
      .from('evolucoes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar evoluções', variant: 'destructive' });
    } else {
      setEvolucoes((data || []) as Evolucao[]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const insertData = {
      ...formData,
      empresa_id: user?.tenantId || null,
      solicitado_por: user?.id,
      status: 'pendente' as const,
    };

    const { data, error } = await supabase
      .from('evolucoes')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar solicitação', variant: 'destructive' });
    } else {
      await logAudit({ action: 'create', entityType: 'evolucoes', entityId: data.id, details: formData });
      toast({ title: 'Solicitação criada com sucesso' });
      fetchEvolucoes();
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleUpdateStatus = async (evolucao: Evolucao, newStatus: string) => {
    const { error } = await supabase
      .from('evolucoes')
      .update({ status: newStatus })
      .eq('id', evolucao.id);

    if (error) {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    } else {
      await logAudit({ action: 'update', entityType: 'evolucoes', entityId: evolucao.id, details: { status: newStatus } });
      toast({ title: 'Status atualizado' });
      fetchEvolucoes();
    }
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      tipo: 'melhoria',
      prioridade: 'media',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Evoluções</h1>
          <p className="text-muted-foreground">
            {isEvolutech ? 'Gerencie todas as solicitações de evolução' : 'Solicite melhorias e novas funcionalidades'}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Solicitação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Evolução</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder="Título da solicitação"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                required
              />
              <Textarea
                placeholder="Descreva a melhoria ou funcionalidade desejada..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                required
                rows={4}
              />
              <Select
                value={formData.tipo}
                onValueChange={(v: any) => setFormData({ ...formData, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="melhoria">Melhoria</SelectItem>
                  <SelectItem value="correcao">Correção</SelectItem>
                  <SelectItem value="nova_funcionalidade">Nova Funcionalidade</SelectItem>
                  <SelectItem value="customizacao">Customização</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={formData.prioridade}
                onValueChange={(v: any) => setFormData({ ...formData, prioridade: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full">Enviar Solicitação</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats by Type */}
      <div className="grid gap-4 md:grid-cols-4">
        {(['melhoria', 'correcao', 'nova_funcionalidade', 'customizacao'] as const).map((tipo) => {
          const Icon = tipoIcons[tipo];
          const count = evolucoes.filter(e => e.tipo === tipo).length;
          return (
            <Card key={tipo}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{tipoLabels[tipo]}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                  <Icon className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Evoluções List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : evolucoes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma evolução solicitada
            </CardContent>
          </Card>
        ) : (
          evolucoes.map((evolucao) => {
            const Icon = tipoIcons[evolucao.tipo];
            return (
              <Card key={evolucao.id} className="hover:bg-secondary/30 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{evolucao.titulo}</h3>
                          <Badge variant="outline">{tipoLabels[evolucao.tipo]}</Badge>
                          <Badge className={prioridadeColors[evolucao.prioridade]}>
                            {evolucao.prioridade.charAt(0).toUpperCase() + evolucao.prioridade.slice(1)}
                          </Badge>
                          <Badge className={statusColors[evolucao.status]}>
                            {statusLabels[evolucao.status]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{evolucao.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          Criado em {format(new Date(evolucao.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          {evolucao.versao_alvo && ` • Versão alvo: ${evolucao.versao_alvo}`}
                        </p>
                      </div>
                    </div>
                    {isEvolutech && (
                      <Select
                        value={evolucao.status}
                        onValueChange={(v) => handleUpdateStatus(evolucao, v)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="em_desenvolvimento">Em Desenvolvimento</SelectItem>
                          <SelectItem value="em_teste">Em Teste</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
