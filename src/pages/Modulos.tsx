import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Edit, Trash2, Package } from 'lucide-react';

interface Modulo {
  id: string;
  nome: string;
  descricao: string | null;
  codigo: string;
  icone: string | null;
  preco_mensal: number;
  is_core: boolean;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
}

export default function Modulos() {
  const { user } = useAuth();
  const { logAudit } = useAuditLog();
  const { toast } = useToast();
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedModulo, setSelectedModulo] = useState<Modulo | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    codigo: '',
    icone: '',
    preco_mensal: 0,
    is_core: false,
    status: 'active' as 'active' | 'inactive' | 'pending',
  });

  const isSuperAdmin = user?.role === 'SUPER_ADMIN_EVOLUTECH';

  useEffect(() => {
    fetchModulos();
  }, []);

  const fetchModulos = async () => {
    const { data, error } = await supabase
      .from('modulos')
      .select('*')
      .order('is_core', { ascending: false })
      .order('nome');

    if (error) {
      toast({ title: 'Erro ao carregar módulos', variant: 'destructive' });
    } else {
      setModulos(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedModulo) {
      const { error } = await supabase
        .from('modulos')
        .update(formData)
        .eq('id', selectedModulo.id);

      if (error) {
        toast({ title: 'Erro ao atualizar', variant: 'destructive' });
      } else {
        await logAudit({ action: 'update', entityType: 'modulos', entityId: selectedModulo.id, details: formData });
        toast({ title: 'Módulo atualizado com sucesso' });
        fetchModulos();
      }
    } else {
      const { data, error } = await supabase
        .from('modulos')
        .insert(formData)
        .select()
        .single();

      if (error) {
        toast({ title: 'Erro ao criar', variant: 'destructive' });
      } else {
        await logAudit({ action: 'create', entityType: 'modulos', entityId: data.id, details: formData });
        toast({ title: 'Módulo criado com sucesso' });
        fetchModulos();
      }
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (modulo: Modulo) => {
    if (!isSuperAdmin) {
      toast({ title: 'Sem permissão', variant: 'destructive' });
      return;
    }

    if (modulo.is_core) {
      toast({ title: 'Não é possível excluir módulos core', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('modulos')
      .delete()
      .eq('id', modulo.id);

    if (error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } else {
      await logAudit({ action: 'delete', entityType: 'modulos', entityId: modulo.id, details: { nome: modulo.nome } });
      toast({ title: 'Módulo excluído' });
      fetchModulos();
    }
  };

  const openEdit = (modulo: Modulo) => {
    setSelectedModulo(modulo);
    setFormData({
      nome: modulo.nome,
      descricao: modulo.descricao || '',
      codigo: modulo.codigo,
      icone: modulo.icone || '',
      preco_mensal: modulo.preco_mensal,
      is_core: modulo.is_core,
      status: modulo.status as 'active' | 'inactive' | 'pending',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedModulo(null);
    setFormData({
      nome: '',
      descricao: '',
      codigo: '',
      icone: '',
      preco_mensal: 0,
      is_core: false,
      status: 'active',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Módulos</h1>
          <p className="text-muted-foreground">Funcionalidades disponíveis para os sistemas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Módulo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedModulo ? 'Editar' : 'Novo'} Módulo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder="Nome do módulo"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
              <Input
                placeholder="Código único (ex: financeiro)"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                required
                disabled={!!selectedModulo}
              />
              <Input
                placeholder="Descrição"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              />
              <Input
                placeholder="Ícone (nome do Lucide)"
                value={formData.icone}
                onChange={(e) => setFormData({ ...formData, icone: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Preço mensal"
                value={formData.preco_mensal}
                onChange={(e) => setFormData({ ...formData, preco_mensal: Number(e.target.value) })}
              />
              <div className="flex items-center justify-between">
                <span>Módulo Core (obrigatório)</span>
                <Switch
                  checked={formData.is_core}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_core: checked })}
                />
              </div>
              <Select
                value={formData.status}
                onValueChange={(v: any) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : modulos.length === 0 ? (
          <p className="col-span-full text-center text-muted-foreground py-8">Nenhum módulo cadastrado</p>
        ) : (
          modulos.map((modulo) => (
            <Card key={modulo.id} className="relative overflow-hidden">
              {modulo.is_core && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-2 py-0.5 text-xs rounded-bl">
                  Core
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {modulo.nome}
                  </span>
                  <Badge variant={modulo.status === 'active' ? 'default' : 'secondary'}>
                    {modulo.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{modulo.descricao || 'Sem descrição'}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Código: {modulo.codigo}</span>
                  <span className="font-semibold text-primary">
                    {modulo.preco_mensal > 0 ? formatCurrency(modulo.preco_mensal) : 'Gratuito'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(modulo)}>
                    <Edit className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  {isSuperAdmin && !modulo.is_core && (
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(modulo)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
