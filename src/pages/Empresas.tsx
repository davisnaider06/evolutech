import React, { useEffect, useState } from 'react';
import { adminService } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Building2, MoreVertical, Trash2, Power, PowerOff, Pencil } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SistemaBase {
  id: string;
  nome: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: 'active' | 'inactive' | 'pending';
  monthly_revenue: number;
  created_at: string;
  document?: string | null;
  sistema_base_id?: string | null;
  owner?: {
    name: string;
    email: string;
  } | null;
}

const Empresas: React.FC = () => {
  const [empresas, setEmpresas] = useState<Tenant[]>([]);
  const [sistemas, setSistemas] = useState<SistemaBase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Tenant | null>(null);

  const [formData, setFormData] = useState({
    empresaNome: '',
    empresaDocumento: '',
    empresaPlano: 'professional',
    sistemaBaseId: '',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    document: '',
    plan: 'professional',
    status: 'active' as 'active' | 'inactive' | 'pending',
    sistema_base_id: '',
  });

  const fetchData = async () => {
    try {
      const [tenantsData, sistemasData] = await Promise.all([
        adminService.listarTenants(),
        adminService.listarSistemasBase(true),
      ]);

      setEmpresas(tenantsData || []);
      setSistemas((sistemasData || []).map((s: any) => ({ id: s.id, nome: s.nome })));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar empresas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormData({
      empresaNome: '',
      empresaDocumento: '',
      empresaPlano: 'professional',
      sistemaBaseId: '',
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.empresaNome || !formData.sistemaBaseId) {
      toast.error('Preencha os campos obrigatorios');
      return;
    }

    setCreating(true);
    try {
      await adminService.criarTenant({ ...formData });

      toast.success('Empresa criada com sucesso');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar empresa');
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (empresa: Tenant) => {
    try {
      const newStatus = empresa.status === 'active' ? 'inactive' : 'active';
      await adminService.atualizarTenant(empresa.id, { status: newStatus });
      toast.success(`Empresa ${newStatus === 'active' ? 'ativada' : 'desativada'}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao alterar status');
    }
  };

  const openEdit = (empresa: Tenant) => {
    setSelectedEmpresa(empresa);
    setEditFormData({
      name: empresa.name || '',
      document: empresa.document || '',
      plan: empresa.plan || 'professional',
      status: empresa.status || 'active',
      sistema_base_id: empresa.sistema_base_id || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpresa) return;
    if (!editFormData.name.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }

    setUpdating(true);
    try {
      await adminService.atualizarTenant(selectedEmpresa.id, {
        name: editFormData.name.trim(),
        document: editFormData.document.trim() || null,
        plan: editFormData.plan,
        status: editFormData.status,
        sistema_base_id: editFormData.sistema_base_id || null,
      });
      toast.success('Empresa atualizada com sucesso');
      setIsEditDialogOpen(false);
      setSelectedEmpresa(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar empresa');
    } finally {
      setUpdating(false);
    }
  };

  const removeTenant = async (empresa: Tenant) => {
    try {
      await adminService.excluirTenant(empresa.id);
      toast.success('Empresa excluida');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir empresa');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Empresas</h1>
          <p className="text-muted-foreground">Crie a empresa e vincule o sistema base. O dono e equipe sao cadastrados depois.</p>
        </div>
        <Button className="gap-2" onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Empresa</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Dono</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Plano</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Criado em</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((empresa) => (
                  <tr key={empresa.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{empresa.name}</p>
                          <p className="text-sm text-muted-foreground">{empresa.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <p>{empresa.owner?.name || '-'}</p>
                      <p className="text-muted-foreground">{empresa.owner?.email || '-'}</p>
                    </td>
                    <td className="px-6 py-4"><Badge variant="outline">{empresa.plan}</Badge></td>
                    <td className="px-6 py-4">
                      <Badge variant={empresa.status === 'active' ? 'default' : 'secondary'}>{empresa.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(empresa.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(empresa)}>
                            <Pencil className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStatus(empresa)}>
                            {empresa.status === 'active' ? (
                              <><PowerOff className="h-4 w-4 mr-2" />Desativar</>
                            ) : (
                              <><Power className="h-4 w-4 mr-2" />Ativar</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => removeTenant(empresa)}>
                            <Trash2 className="h-4 w-4 mr-2" />Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>Cria a empresa e ativa os modulos do sistema base automaticamente.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da empresa *</Label>
              <Input value={formData.empresaNome} onChange={(e) => setFormData({ ...formData, empresaNome: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Documento</Label>
              <Input value={formData.empresaDocumento} onChange={(e) => setFormData({ ...formData, empresaDocumento: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={formData.empresaPlano} onValueChange={(value) => setFormData({ ...formData, empresaPlano: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sistema Base *</Label>
              <Select value={formData.sistemaBaseId} onValueChange={(value) => setFormData({ ...formData, sistemaBaseId: value })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {sistemas.map((sistema) => (
                    <SelectItem key={sistema.id} value={sistema.id}>{sistema.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating}>{creating ? 'Criando...' : 'Criar Empresa'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
            <DialogDescription>Atualize dados da empresa e sistema base vinculado.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da empresa *</Label>
              <Input value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Documento</Label>
              <Input value={editFormData.document} onChange={(e) => setEditFormData({ ...editFormData, document: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={editFormData.plan} onValueChange={(value) => setEditFormData({ ...editFormData, plan: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value: 'active' | 'inactive' | 'pending') =>
                    setEditFormData({ ...editFormData, status: value })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sistema Base</Label>
              <Select
                value={editFormData.sistema_base_id || '__none__'}
                onValueChange={(value) =>
                  setEditFormData({ ...editFormData, sistema_base_id: value === '__none__' ? '' : value })
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem sistema base</SelectItem>
                  {sistemas.map((sistema) => (
                    <SelectItem key={sistema.id} value={sistema.id}>{sistema.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updating}>{updating ? 'Salvando...' : 'Salvar Alterações'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Empresas;
