import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { Plus, GraduationCap, Play, FileText, Video, Users, Check } from 'lucide-react';

interface Treinamento {
  id: string;
  empresa_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: 'video' | 'documento' | 'webinar' | 'presencial';
  url_conteudo: string | null;
  duracao_minutos: number | null;
  is_publico: boolean;
  ordem: number;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
}

interface Progresso {
  treinamento_id: string;
  concluido: boolean;
  progresso_percentual: number;
}

const tipoIcons = {
  video: Video,
  documento: FileText,
  webinar: Users,
  presencial: GraduationCap,
};

const tipoLabels = {
  video: 'Vídeo',
  documento: 'Documento',
  webinar: 'Webinar',
  presencial: 'Presencial',
};

export default function Treinamentos() {
  const { user } = useAuth();
  const { logAudit } = useAuditLog();
  const { toast } = useToast();
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [progressos, setProgressos] = useState<Map<string, Progresso>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo: 'video' as const,
    url_conteudo: '',
    duracao_minutos: 0,
    is_publico: true,
    ordem: 0,
  });

  const isEvolutech = user?.role === 'SUPER_ADMIN_EVOLUTECH' || user?.role === 'ADMIN_EVOLUTECH';

  useEffect(() => {
    fetchTreinamentos();
    fetchProgresso();
  }, [user]);

  const fetchTreinamentos = async () => {
    const { data, error } = await supabase
      .from('treinamentos')
      .select('*')
      .eq('status', 'active')
      .order('ordem');

    if (error) {
      toast({ title: 'Erro ao carregar treinamentos', variant: 'destructive' });
    } else {
      setTreinamentos((data || []) as Treinamento[]);
    }
    setLoading(false);
  };

  const fetchProgresso = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('treinamento_progresso')
      .select('treinamento_id, concluido, progresso_percentual')
      .eq('usuario_id', user.id);

    if (data) {
      const map = new Map<string, Progresso>();
      data.forEach(p => map.set(p.treinamento_id, p));
      setProgressos(map);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const insertData = {
      ...formData,
      empresa_id: formData.is_publico ? null : user?.tenantId,
      status: 'active' as const,
    };

    const { data, error } = await supabase
      .from('treinamentos')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar treinamento', variant: 'destructive' });
    } else {
      await logAudit({ action: 'create', entityType: 'treinamentos', entityId: data.id, details: formData });
      toast({ title: 'Treinamento criado com sucesso' });
      fetchTreinamentos();
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleMarcarConcluido = async (treinamentoId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('treinamento_progresso')
      .upsert({
        treinamento_id: treinamentoId,
        usuario_id: user.id,
        empresa_id: user.tenantId,
        concluido: true,
        progresso_percentual: 100,
        data_conclusao: new Date().toISOString(),
      });

    if (error) {
      toast({ title: 'Erro ao marcar como concluído', variant: 'destructive' });
    } else {
      toast({ title: 'Treinamento concluído!' });
      fetchProgresso();
    }
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      tipo: 'video',
      url_conteudo: '',
      duracao_minutos: 0,
      is_publico: true,
      ordem: 0,
    });
  };

  const concluidos = Array.from(progressos.values()).filter(p => p.concluido).length;
  const totalPercent = treinamentos.length > 0 ? (concluidos / treinamentos.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Treinamentos</h1>
          <p className="text-muted-foreground">
            {isEvolutech ? 'Gerencie os treinamentos da plataforma' : 'Aprenda a usar o sistema'}
          </p>
        </div>
        {isEvolutech && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Treinamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Treinamento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder="Título do treinamento"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  required
                />
                <Textarea
                  placeholder="Descrição"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                />
                <Select
                  value={formData.tipo}
                  onValueChange={(v: any) => setFormData({ ...formData, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="documento">Documento</SelectItem>
                    <SelectItem value="webinar">Webinar</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="URL do conteúdo"
                  value={formData.url_conteudo}
                  onChange={(e) => setFormData({ ...formData, url_conteudo: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Duração (minutos)"
                  value={formData.duracao_minutos}
                  onChange={(e) => setFormData({ ...formData, duracao_minutos: Number(e.target.value) })}
                />
                <Input
                  type="number"
                  placeholder="Ordem de exibição"
                  value={formData.ordem}
                  onChange={(e) => setFormData({ ...formData, ordem: Number(e.target.value) })}
                />
                <Button type="submit" className="w-full">Criar Treinamento</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Progress Overview */}
      {!isEvolutech && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Seu Progresso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {concluidos} de {treinamentos.length} treinamentos concluídos
              </span>
              <span className="font-semibold">{Math.round(totalPercent)}%</span>
            </div>
            <Progress value={totalPercent} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Treinamentos Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : treinamentos.length === 0 ? (
          <p className="col-span-full text-center text-muted-foreground py-8">
            Nenhum treinamento disponível
          </p>
        ) : (
          treinamentos.map((treinamento) => {
            const Icon = tipoIcons[treinamento.tipo];
            const progresso = progressos.get(treinamento.id);
            const concluido = progresso?.concluido || false;

            return (
              <Card key={treinamento.id} className={concluido ? 'border-green-500/50' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{treinamento.titulo}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {tipoLabels[treinamento.tipo]}
                        </Badge>
                      </div>
                    </div>
                    {concluido && (
                      <div className="p-1 rounded-full bg-green-500">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {treinamento.descricao || 'Sem descrição'}
                  </p>
                  {treinamento.duracao_minutos && (
                    <p className="text-xs text-muted-foreground">
                      Duração: {treinamento.duracao_minutos} minutos
                    </p>
                  )}
                  <div className="flex gap-2">
                    {treinamento.url_conteudo && (
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => window.open(treinamento.url_conteudo!, '_blank')}
                      >
                        <Play className="h-4 w-4" />
                        Acessar
                      </Button>
                    )}
                    {!isEvolutech && !concluido && (
                      <Button
                        variant="default"
                        className="flex-1 gap-2"
                        onClick={() => handleMarcarConcluido(treinamento.id)}
                      >
                        <Check className="h-4 w-4" />
                        Concluir
                      </Button>
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
