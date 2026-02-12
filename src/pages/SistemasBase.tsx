import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Edit, Trash2, Blocks, Package } from 'lucide-react';

interface SistemaBase {
  id: string;
  nome: string;
  descricao: string | null;
  nicho: string;
  versao: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
}

interface Modulo {
  id: string;
  nome: string;
  codigo: string;
  is_core: boolean;
}

export default function SistemasBase() {
  const { user } = useAuth();
  const { logAudit } = useAuditLog();
  const { toast } = useToast();
  const [sistemas, setSistemas] = useState<SistemaBase[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isModulosDialogOpen, setIsModulosDialogOpen] = useState(false);
  const [selectedSistema, setSelectedSistema] = useState<SistemaBase | null>(null);
  const [selectedModulos, setSelectedModulos] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    nicho: '',
    versao: '1.0.0',
    status: 'active' as 'active' | 'inactive' | 'pending',
  });

  const isSuperAdmin = user?.role === 'SUPER_ADMIN_EVOLUTECH';

  useEffect(() => {
    fetchSistemas();
    fetchModulos();
  }, []);

  const fetchSistemas = async () => {
    const { data, error } = await supabase
      .from('sistemas_base')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar sistemas', variant: 'destructive' });
    } else {
      setSistemas(data || []);
    }
    setLoading(false);
  };

  const fetchModulos = async () => {
    const { data } = await supabase
      .from('modulos')
      .select('id, nome, codigo, is_core')
      .eq('status', 'active');
    setModulos(data || []);
  };

  const fetchSistemaModulos = async (sistemaId: string) => {
    const { data } = await supabase
      .from('sistema_base_modulos')
      .select('modulo_id')
      .eq('sistema_base_id', sistemaId);
    
    setSelectedModulos(data?.map(m => m.modulo_id) || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedSistema) {
      const { error } = await supabase
        .from('sistemas_base')
        .update(formData)
        .eq('id', selectedSistema.id);

      if (error) {
        toast({ title: 'Erro ao atualizar', variant: 'destructive' });
      } else {
        await logAudit({ action: 'update', entityType: 'sistemas_base', entityId: selectedSistema.id, details: formData });
        toast({ title: 'Sistema atualizado com sucesso' });
        fetchSistemas();
      }
    } else {
      const { data, error } = await supabase
        .from('sistemas_base')
        .insert(formData)
        .select()
        .single();

      if (error) {
        toast({ title: 'Erro ao criar', variant: 'destructive' });
      } else {
        await logAudit({ action: 'create', entityType: 'sistemas_base', entityId: data.id, details: formData });
        toast({ title: 'Sistema criado com sucesso' });
        fetchSistemas();
      }
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (sistema: SistemaBase) => {
    if (!isSuperAdmin) {
      toast({ title: 'Sem permissão', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('sistemas_base')
      .delete()
      .eq('id', sistema.id);

    if (error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    } else {
      await logAudit({ action: 'delete', entityType: 'sistemas_base', entityId: sistema.id, details: { nome: sistema.nome } });
      toast({ title: 'Sistema excluído' });
      fetchSistemas();
    }
  };

  const handleSaveModulos = async () => {
    if (!selectedSistema) return;

    // Delete existing
    await supabase
      .from('sistema_base_modulos')
      .delete()
      .eq('sistema_base_id', selectedSistema.id);

    // Insert new
    if (selectedModulos.length > 0) {
      const inserts = selectedModulos.map(moduloId => ({
        sistema_base_id: selectedSistema.id,
        modulo_id: moduloId,
        is_default: modulos.find(m => m.id === moduloId)?.is_core || false,
      }));

      await supabase.from('sistema_base_modulos').insert(inserts);
    }

    await logAudit({ action: 'update', entityType: 'sistema_base_modulos', entityId: selectedSistema.id, details: { modulos: selectedModulos } });
    toast({ title: 'Módulos atualizados' });
    setIsModulosDialogOpen(false);
  };

  const openEdit = (sistema: SistemaBase) => {
    setSelectedSistema(sistema);
    setFormData({
      nome: sistema.nome,
      descricao: sistema.descricao || '',
      nicho: sistema.nicho,
      versao: sistema.versao,
      status: sistema.status as 'active' | 'inactive' | 'pending',
    });
    setIsDialogOpen(true);
  };

  const openModulos = async (sistema: SistemaBase) => {
    setSelectedSistema(sistema);
    await fetchSistemaModulos(sistema.id);
    setIsModulosDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedSistema(null);
    setFormData({
      nome: '',
      descricao: '',
      nicho: '',
      versao: '1.0.0',
      status: 'active',
    });
  };

  const toggleModulo = (moduloId: string) => {
    setSelectedModulos(prev =>
      prev.includes(moduloId)
        ? prev.filter(id => id !== moduloId)
        : [...prev, moduloId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sistemas Base</h1>
          <p className="text-muted-foreground">Templates de sistemas para clientes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Sistema
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedSistema ? 'Editar' : 'Novo'} Sistema Base</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder="Nome do sistema"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
              <Input
                placeholder="Descrição"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              />
              <Input
                placeholder="Nicho (ex: Serviços, Varejo)"
                value={formData.nicho}
                onChange={(e) => setFormData({ ...formData, nicho: e.target.value })}
                required
              />
              <Input
                placeholder="Versão"
                value={formData.versao}
                onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
              />
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
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="w-full">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Blocks className="h-5 w-5" />
            Sistemas Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : sistemas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum sistema cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Nicho</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sistemas.map((sistema) => (
                  <TableRow key={sistema.id}>
                    <TableCell className="font-medium">{sistema.nome}</TableCell>
                    <TableCell>{sistema.nicho}</TableCell>
                    <TableCell>{sistema.versao}</TableCell>
                    <TableCell>
                      <Badge variant={sistema.status === 'active' ? 'default' : 'secondary'}>
                        {sistema.status === 'active' ? 'Ativo' : sistema.status === 'inactive' ? 'Inativo' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openModulos(sistema)}>
                        <Package className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(sistema)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {isSuperAdmin && (
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(sistema)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Módulos Dialog */}
      <Dialog open={isModulosDialogOpen} onOpenChange={setIsModulosDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Módulos de {selectedSistema?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[50vh] pr-2">
            {modulos.map((modulo) => (
              <div
                key={modulo.id}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedModulos.includes(modulo.id) ? 'bg-primary/10 border-primary' : 'hover:bg-secondary'
                }`}
                onClick={() => toggleModulo(modulo.id)}
              >
                <div>
                  <p className="font-medium">{modulo.nome}</p>
                  <p className="text-sm text-muted-foreground">{modulo.codigo}</p>
                </div>
                {modulo.is_core && <Badge variant="outline">Core</Badge>}
              </div>
            ))}
          </div>
          <Button onClick={handleSaveModulos} className="w-full">Salvar Módulos</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
