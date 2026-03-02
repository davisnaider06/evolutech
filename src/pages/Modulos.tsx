import React, { useEffect, useState } from 'react';
import { adminService } from '@/services/admin';
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
import { Plus, Edit, Trash2, Package } from 'lucide-react';

interface Modulo {
  id: string;
  nome: string;
  descricao: string | null;
  codigo: string;
  icone: string | null;
  nicho: string | null;
  precoMensal: number;
  isCore: boolean;
  isPro?: boolean;
  allowedRoles?: string[];
  status: 'active' | 'inactive' | 'pending';
}

export default function Modulos() {
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
    nicho: 'geral',
    preco_mensal: 0,
    is_core: false,
    is_pro: false,
    allowed_roles: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'] as string[],
    status: 'active' as 'active' | 'inactive' | 'pending',
  });

  const fetchModulos = async () => {
    try {
      const data = await adminService.listarModulos(false);
      setModulos(data || []);
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao carregar modulos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModulos();
  }, []);

  const resetForm = () => {
    setSelectedModulo(null);
    setFormData({
      nome: '',
      descricao: '',
      codigo: '',
      icone: '',
      nicho: 'geral',
      preco_mensal: 0,
      is_core: false,
      is_pro: false,
      allowed_roles: ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'],
      status: 'active',
    });
  };

  const openEdit = (modulo: Modulo) => {
    setSelectedModulo(modulo);
    setFormData({
      nome: modulo.nome,
      descricao: modulo.descricao || '',
      codigo: modulo.codigo,
      icone: modulo.icone || '',
      nicho: modulo.nicho || 'geral',
      preco_mensal: Number(modulo.precoMensal || 0),
      is_core: modulo.isCore,
      is_pro: Boolean(modulo.isPro),
      allowed_roles: Array.isArray(modulo.allowedRoles) && modulo.allowedRoles.length > 0
        ? modulo.allowedRoles
        : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'],
      status: modulo.status,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedModulo) {
        await adminService.atualizarModulo(selectedModulo.id, formData);
        toast({ title: 'Modulo atualizado com sucesso' });
      } else {
        await adminService.criarModulo(formData);
        toast({ title: 'Modulo criado com sucesso' });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchModulos();
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao salvar modulo', variant: 'destructive' });
    }
  };

  const handleDelete = async (modulo: Modulo) => {
    if (modulo.isCore) {
      toast({ title: 'Nao e possivel excluir modulo core', variant: 'destructive' });
      return;
    }

    try {
      await adminService.excluirModulo(modulo.id);
      toast({ title: 'Modulo excluido' });
      fetchModulos();
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao excluir modulo', variant: 'destructive' });
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const toggleAllowedRole = (role: 'DONO_EMPRESA' | 'FUNCIONARIO_EMPRESA') => {
    setFormData((old) => {
      const current = old.allowed_roles || [];
      const next = current.includes(role) ? current.filter((item) => item !== role) : [...current, role];
      return {
        ...old,
        allowed_roles: next.length ? next : ['DONO_EMPRESA'],
      };
    });
  };

  const roleLabel = (role: string) =>
    role === 'DONO_EMPRESA' ? 'Dono' : role === 'FUNCIONARIO_EMPRESA' ? 'Funcionario' : role;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Modulos</h1>
          <p className="text-muted-foreground">Funcionalidades base dos sistemas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Modulo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedModulo ? 'Editar' : 'Novo'} Modulo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input placeholder="Nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
              <Input placeholder="Codigo unico" value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} required disabled={!!selectedModulo} />
              <Input placeholder="Descricao" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} />
              <Input placeholder="Nicho (ex: barbearia, clinica)" value={formData.nicho} onChange={(e) => setFormData({ ...formData, nicho: e.target.value })} />
              <Input placeholder="Icone" value={formData.icone} onChange={(e) => setFormData({ ...formData, icone: e.target.value })} />
              <Input type="number" placeholder="Preco mensal" value={formData.preco_mensal} onChange={(e) => setFormData({ ...formData, preco_mensal: Number(e.target.value) })} />
              <div className="flex items-center justify-between">
                <span>Modulo core</span>
                <Switch checked={formData.is_core} onCheckedChange={(checked) => setFormData({ ...formData, is_core: checked })} />
              </div>
              <div className="flex items-center justify-between">
                <span>Modulo Pro</span>
                <Switch checked={formData.is_pro} onCheckedChange={(checked) => setFormData({ ...formData, is_pro: checked })} />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Roles permitidos</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.allowed_roles.includes('DONO_EMPRESA')}
                      onChange={() => toggleAllowedRole('DONO_EMPRESA')}
                    />
                    Dono
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.allowed_roles.includes('FUNCIONARIO_EMPRESA')}
                      onChange={() => toggleAllowedRole('FUNCIONARIO_EMPRESA')}
                    />
                    Funcionario
                  </label>
                </div>
              </div>
              <Select value={formData.status} onValueChange={(v: 'active' | 'inactive' | 'pending') => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
          <p className="col-span-full text-center text-muted-foreground py-8">Nenhum modulo cadastrado</p>
        ) : (
          modulos.map((modulo) => (
            <Card key={modulo.id} className="relative overflow-hidden">
              {modulo.isCore && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-2 py-0.5 text-xs rounded-bl">
                  Core
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {modulo.nome} {modulo.nicho ? `(${modulo.nicho})` : ''}
                  </span>
                  <Badge variant={modulo.status === 'active' ? 'default' : 'secondary'}>
                    {modulo.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{modulo.descricao || 'Sem descricao'}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Codigo: {modulo.codigo}</span>
                  <span className="font-semibold text-primary">{formatCurrency(Number(modulo.precoMensal || 0))}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {modulo.isPro && <Badge variant="outline">Pro</Badge>}
                  {(modulo.allowedRoles || ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA']).map((role) => (
                    <Badge key={`${modulo.id}-${role}`} variant="secondary">
                      {roleLabel(role)}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(modulo)}>
                    <Edit className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  {!modulo.isCore && (
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
