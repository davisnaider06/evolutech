import React, { useEffect, useState } from 'react';
import { adminService } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2, Blocks, Save } from 'lucide-react';

interface Modulo {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  isCore: boolean;
  isPro?: boolean;
  allowedRoles?: string[];
  precoMensal: number;
  status: 'active' | 'inactive' | 'pending';
}

interface SistemaBase {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  status: 'active' | 'inactive' | 'pending';
}

interface SistemaModulo {
  modulo_id: string;
  allowed_roles?: string[];
}

export default function GestaoSistemasBase() {
  const { toast } = useToast();
  const [sistemas, setSistemas] = useState<SistemaBase[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [sistemaModulos, setSistemaModulos] = useState<SistemaModulo[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSistema, setSelectedSistema] = useState<SistemaBase | null>(null);
  const [activeRoleTab, setActiveRoleTab] = useState<'DONO_EMPRESA' | 'FUNCIONARIO_EMPRESA'>('DONO_EMPRESA');
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    nicho: '',
    status: 'active' as 'active' | 'inactive' | 'pending',
  });
  const highlightedModuleCodes = new Set(['customer_portal', 'courses']);
  const roleLabel = (role: string) =>
    role === 'DONO_EMPRESA' ? 'Dono' : role === 'FUNCIONARIO_EMPRESA' ? 'Funcionario' : role;

  const fetchAll = async () => {
    try {
      const [systemsData, modulesData] = await Promise.all([
        adminService.listarSistemasBase(false),
        adminService.listarModulos(true),
      ]);
      setSistemas(systemsData || []);
      const sortedModules = [...(modulesData || [])].sort((a: Modulo, b: Modulo) => {
        const aPriority = highlightedModuleCodes.has((a.codigo || '').toLowerCase()) ? 0 : 1;
        const bPriority = highlightedModuleCodes.has((b.codigo || '').toLowerCase()) ? 0 : 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
      });
      setModulos(sortedModules);
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openNew = () => {
    setSelectedSistema(null);
    setFormData({ nome: '', descricao: '', nicho: '', status: 'active' });
    setSistemaModulos([]);
    setActiveRoleTab('DONO_EMPRESA');
    setIsDialogOpen(true);
  };

  const openEdit = async (sistema: SistemaBase) => {
    setSelectedSistema(sistema);
    setFormData({
      nome: sistema.nome,
      descricao: sistema.descricao || '',
      nicho: sistema.categoria || '',
      status: sistema.status,
    });

    try {
      const data = await adminService.listarModulosSistemaBase(sistema.id);
      setSistemaModulos(
        (data || []).map((item: any) => ({
          modulo_id: item.modulo_id,
          allowed_roles: Array.isArray(item.allowed_roles) ? item.allowed_roles : item.modulos?.allowed_roles || [],
        }))
      );
      setActiveRoleTab('DONO_EMPRESA');
      setIsDialogOpen(true);
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao carregar modulos do sistema', variant: 'destructive' });
    }
  };

  const getModuloRoles = (moduloId: string) => {
    const item = sistemaModulos.find((entry) => entry.modulo_id === moduloId);
    return Array.isArray(item?.allowed_roles) && item.allowed_roles.length > 0
      ? item.allowed_roles
      : [];
  };

  const isModuloSelectedForRole = (moduloId: string, role: 'DONO_EMPRESA' | 'FUNCIONARIO_EMPRESA') =>
    getModuloRoles(moduloId).includes(role);

  const toggleModuloRole = (moduloId: string, role: 'DONO_EMPRESA' | 'FUNCIONARIO_EMPRESA') => {
    setSistemaModulos((prev) => {
      const existing = prev.find((item) => item.modulo_id === moduloId);
      const currentRoles = Array.isArray(existing?.allowed_roles) ? existing.allowed_roles : [];
      const nextRoles = currentRoles.includes(role)
        ? currentRoles.filter((item) => item !== role)
        : [...currentRoles, role];

      if (nextRoles.length === 0) {
        return prev.filter((m) => m.modulo_id !== moduloId);
      }

      if (existing) {
        return prev.map((item) =>
          item.modulo_id === moduloId
            ? { ...item, allowed_roles: nextRoles }
            : item
        );
      }

      return [...prev, { modulo_id: moduloId, allowed_roles: nextRoles }];
    });
  };

  const getModulesForRoleTab = (role: 'DONO_EMPRESA' | 'FUNCIONARIO_EMPRESA') =>
    modulos.filter((modulo) => {
      const allowedRoles =
        Array.isArray(modulo.allowedRoles) && modulo.allowedRoles.length > 0
          ? modulo.allowedRoles
          : ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'];
      return allowedRoles.includes(role);
    });

  const handleSave = async () => {
    if (!formData.nome.trim() || !formData.nicho.trim()) {
      toast({ title: 'Nome e nicho sao obrigatorios', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let sistemaId = selectedSistema?.id;

      if (selectedSistema) {
        await adminService.atualizarSistemaBase(selectedSistema.id, {
          nome: formData.nome,
          descricao: formData.descricao,
          nicho: formData.nicho,
          status: formData.status,
        });
      } else {
        const created = await adminService.criarSistemaBase({
          nome: formData.nome,
          descricao: formData.descricao,
          nicho: formData.nicho,
          status: formData.status,
        });
        sistemaId = created.id;
      }

      if (sistemaId) {
        await adminService.salvarModulosSistemaBase(
          sistemaId,
          sistemaModulos.map((item) => ({
            modulo_id: item.modulo_id,
            allowed_roles: item.allowed_roles || [],
          }))
        );
      }

      toast({ title: 'Sistema salvo com sucesso' });
      setIsDialogOpen(false);
      fetchAll();
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao salvar sistema', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sistema: SistemaBase) => {
    try {
      await adminService.excluirSistemaBase(sistema.id);
      toast({ title: 'Sistema removido com sucesso' });
      fetchAll();
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao excluir sistema', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sistemas Base</h1>
          <p className="text-muted-foreground">Monte templates funcionais para onboard de clientes</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Sistema
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : sistemas.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-10 text-center text-muted-foreground">Nenhum sistema cadastrado</CardContent>
          </Card>
        ) : (
          sistemas.map((sistema) => (
            <Card key={sistema.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><Blocks className="h-5 w-5" />{sistema.nome}</span>
                  <Badge variant={sistema.status === 'active' ? 'default' : 'secondary'}>{sistema.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{sistema.descricao || 'Sem descricao'}</p>
                <p className="text-sm"><strong>Nicho:</strong> {sistema.categoria || 'Generico'}</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => openEdit(sistema)}>
                    <Edit className="h-4 w-4 mr-2" />Editar
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(sistema)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSistema ? 'Editar Sistema' : 'Novo Sistema Base'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nicho</Label>
                <Input value={formData.nicho} onChange={(e) => setFormData({ ...formData, nicho: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v: 'active' | 'inactive' | 'pending') => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Modulos do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Tabs value={activeRoleTab} onValueChange={(value) => setActiveRoleTab(value as 'DONO_EMPRESA' | 'FUNCIONARIO_EMPRESA')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="DONO_EMPRESA">Dono</TabsTrigger>
                    <TabsTrigger value="FUNCIONARIO_EMPRESA">Funcionario</TabsTrigger>
                  </TabsList>

                  <TabsContent value="DONO_EMPRESA" className="space-y-2">
                    {getModulesForRoleTab('DONO_EMPRESA').map((modulo) => (
                      <div key={`${modulo.id}-owner`} className="flex items-center justify-between rounded border p-3">
                        <div>
                          <p className="font-medium">{modulo.nome}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-muted-foreground">{modulo.codigo}</p>
                            {highlightedModuleCodes.has((modulo.codigo || '').toLowerCase()) && (
                              <Badge variant="outline">Portal Cliente</Badge>
                            )}
                            {modulo.isPro && <Badge variant="outline">Pro</Badge>}
                            {(modulo.allowedRoles || ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA']).map((role) => (
                              <Badge key={`${modulo.id}-${role}`} variant="secondary">
                                {roleLabel(role)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Checkbox
                          checked={isModuloSelectedForRole(modulo.id, 'DONO_EMPRESA')}
                          onCheckedChange={() => toggleModuloRole(modulo.id, 'DONO_EMPRESA')}
                        />
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="FUNCIONARIO_EMPRESA" className="space-y-2">
                    {getModulesForRoleTab('FUNCIONARIO_EMPRESA').map((modulo) => (
                      <div key={`${modulo.id}-staff`} className="flex items-center justify-between rounded border p-3">
                        <div>
                          <p className="font-medium">{modulo.nome}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm text-muted-foreground">{modulo.codigo}</p>
                            {highlightedModuleCodes.has((modulo.codigo || '').toLowerCase()) && (
                              <Badge variant="outline">Portal Cliente</Badge>
                            )}
                            {modulo.isPro && <Badge variant="outline">Pro</Badge>}
                            {(modulo.allowedRoles || ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA']).map((role) => (
                              <Badge key={`${modulo.id}-${role}`} variant="secondary">
                                {roleLabel(role)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Checkbox
                          checked={isModuloSelectedForRole(modulo.id, 'FUNCIONARIO_EMPRESA')}
                          onCheckedChange={() => toggleModuloRole(modulo.id, 'FUNCIONARIO_EMPRESA')}
                        />
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar Sistema'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
