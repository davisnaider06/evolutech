import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminService } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoleBadge } from '@/components/RoleBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { UserRole } from '@/types/auth';
import {
  Plus,
  Search,
  MoreVertical,
  Filter,
  Mail,
  Calendar,
  Power,
  PowerOff,
} from 'lucide-react';

interface UsuarioApi {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  roles: Array<{
    role: UserRole;
    company_id: string | null;
    company_name: string | null;
  }>;
}

interface TenantOption {
  id: string;
  name: string;
}

const Usuarios: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioApi[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'FUNCIONARIO_EMPRESA' as UserRole,
    company_id: '',
  });

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN_EVOLUTECH';
  const isEvolutechTeam = hasPermission(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']);
  const roleNeedsCompany = formData.role === 'DONO_EMPRESA' || formData.role === 'FUNCIONARIO_EMPRESA';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, tenantsData] = await Promise.all([
        adminService.listarUsuarios(),
        adminService.listarTenants(),
      ]);
      setUsuarios(usersData || []);
      setTenants((tenantsData || []).map((tenant: any) => ({ id: tenant.id, name: tenant.name })));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredUsuarios = useMemo(() => {
    return usuarios.filter((usuario) => {
      const matchesSearch =
        usuario.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        usuario.email.toLowerCase().includes(searchTerm.toLowerCase());

      if (!isEvolutechTeam) {
        const primaryRole = usuario.roles[0]?.role;
        return matchesSearch && (primaryRole === 'DONO_EMPRESA' || primaryRole === 'FUNCIONARIO_EMPRESA');
      }

      return matchesSearch;
    });
  }, [usuarios, searchTerm, isEvolutechTeam]);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'FUNCIONARIO_EMPRESA',
      company_id: '',
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast.error('Preencha nome, e-mail e senha');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Senha deve ter ao menos 6 caracteres');
      return;
    }

    if (roleNeedsCompany && !formData.company_id) {
      toast.error('Selecione uma empresa para este perfil');
      return;
    }

    setCreating(true);
    try {
      await adminService.criarUsuario({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        company_id: roleNeedsCompany ? formData.company_id : null,
      });

      toast.success('Usuário criado com sucesso');
      setIsCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (usuario: UsuarioApi) => {
    setTogglingUserId(usuario.id);
    try {
      await adminService.alternarStatusUsuario(usuario.id);
      toast.success(usuario.is_active ? 'Usuário desativado' : 'Usuário ativado');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao alterar status');
    } finally {
      setTogglingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl">Usuários</h1>
          <p className="text-muted-foreground">
            {isEvolutechTeam
              ? 'Gerencie todos os usuários da plataforma'
              : 'Gerencie os funcionários da sua empresa'}
          </p>
        </div>
        <Button variant="glow" className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" className="gap-2" disabled>
          <Filter className="h-4 w-4" />
          Filtros
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUsuarios.map((usuario, index) => {
            const primaryRole = usuario.roles[0]?.role || 'FUNCIONARIO_EMPRESA';
            const tenantName = usuario.roles[0]?.company_name || undefined;
            return (
              <div
                key={usuario.id}
                className={cn('glass rounded-xl p-5 transition-all duration-200 hover:shadow-elevated hover:border-primary/30 animate-fade-in')}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full gradient-primary text-lg font-semibold text-primary-foreground">
                        {usuario.name.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={cn(
                          'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card',
                          usuario.is_active ? 'bg-role-client-admin' : 'bg-muted-foreground'
                        )}
                      />
                    </div>
                    <div>
                      <p className="font-semibold">{usuario.name}</p>
                      <RoleBadge role={primaryRole} size="sm" />
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={togglingUserId === usuario.id}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {usuario.is_active ? (
                        <DropdownMenuItem onClick={() => handleToggleStatus(usuario)}>
                          <PowerOff className="h-4 w-4 mr-2" />
                          Desativar
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleToggleStatus(usuario)}>
                          <Power className="h-4 w-4 mr-2" />
                          Ativar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{usuario.email}</span>
                  </div>
                  {tenantName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-xs bg-secondary px-2 py-0.5 rounded">{tenantName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Criado em: {new Date(usuario.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Crie um novo usuário e defina o nível hierárquico.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Senha *</Label>
                <Input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Perfil *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: UserRole) =>
                  setFormData({
                    ...formData,
                    role: value,
                    company_id:
                      value === 'DONO_EMPRESA' || value === 'FUNCIONARIO_EMPRESA'
                        ? formData.company_id
                        : '',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isSuperAdmin && <SelectItem value="SUPER_ADMIN_EVOLUTECH">Super Admin Evolutech</SelectItem>}
                  <SelectItem value="ADMIN_EVOLUTECH">Admin Evolutech</SelectItem>
                  <SelectItem value="DONO_EMPRESA">Dono da Empresa</SelectItem>
                  <SelectItem value="FUNCIONARIO_EMPRESA">Funcionário da Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {roleNeedsCompany && (
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(value) => setFormData({ ...formData, company_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Criando...' : 'Criar Usuário'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Usuarios;
