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
import { Plus, Building2, MoreVertical, Trash2, Power, PowerOff } from 'lucide-react';
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
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const [formData, setFormData] = useState({
    empresaNome: '',
    empresaDocumento: '',
    empresaPlano: 'professional',
    sistemaBaseId: '',
    donoNome: '',
    donoEmail: '',
    donoSenha: '',
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
      donoNome: '',
      donoEmail: '',
      donoSenha: '',
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.empresaNome || !formData.sistemaBaseId || !formData.donoNome || !formData.donoEmail) {
      toast.error('Preencha os campos obrigatorios');
      return;
    }

    setCreating(true);
    try {
      const result = await adminService.criarTenant({
        ...formData,
        donoRole: 'DONO_EMPRESA',
      });

      setCredentials({
        email: result.credentials.email,
        password: result.credentials.temporaryPassword,
      });

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
          <p className="text-muted-foreground">Onboarding completo de clientes com dono e sistema base</p>
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
            <DialogTitle>Novo Onboarding de Cliente</DialogTitle>
            <DialogDescription>Cria empresa, dono e ativa os modulos do sistema base automaticamente.</DialogDescription>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome do dono *</Label>
                <Input value={formData.donoNome} onChange={(e) => setFormData({ ...formData, donoNome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email do dono *</Label>
                <Input type="email" value={formData.donoEmail} onChange={(e) => setFormData({ ...formData, donoEmail: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Senha inicial (opcional)</Label>
              <Input type="text" value={formData.donoSenha} onChange={(e) => setFormData({ ...formData, donoSenha: e.target.value })} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating}>{creating ? 'Criando...' : 'Criar Empresa'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!credentials} onOpenChange={() => setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credenciais do Cliente</DialogTitle>
            <DialogDescription>Envie esses dados ao cliente para primeiro acesso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><strong>Email:</strong> {credentials?.email}</p>
            <p><strong>Senha temporaria:</strong> {credentials?.password}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Empresas;
