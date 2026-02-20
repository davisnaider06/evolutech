import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminService } from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { ROLE_LABELS, ROLE_COLORS, UserRole } from '@/types/auth';
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Mail,
  Building2,
  Shield,
  UserCheck,
  RefreshCw,
  Filter,
  Key,
  Trash2,
} from 'lucide-react';

interface UserWithRole {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  roles: {
    role: UserRole;
    company_id: string | null;
    company_name: string | null;
  }[];
}

interface Company {
  id: string;
  name: string;
}

const ROLES_OPTIONS: { value: UserRole; label: string; description: string; requiresCompany: boolean }[] = [
  {
    value: 'SUPER_ADMIN_EVOLUTECH',
    label: 'Super Admin Evolutech',
    description: 'Acesso total à plataforma',
    requiresCompany: false,
  },
  {
    value: 'ADMIN_EVOLUTECH',
    label: 'Admin Evolutech',
    description: 'Administrador da Evolutech',
    requiresCompany: false,
  },
  {
    value: 'DONO_EMPRESA',
    label: 'Dono da Empresa',
    description: 'Proprietário de uma empresa cliente',
    requiresCompany: true,
  },
  {
    value: 'FUNCIONARIO_EMPRESA',
    label: 'Funcionário',
    description: 'Funcionário de uma empresa',
    requiresCompany: true,
  },
];

const GerenciarUsuarios: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'FUNCIONARIO_EMPRESA' as UserRole,
    company_id: '',
  });

  const isSuperAdmin = hasPermission(['SUPER_ADMIN_EVOLUTECH']);
  const isEvolutechTeam = hasPermission(['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH']);

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await adminService.listarUsuarios();
      setUsers(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const data = await adminService.listarTenants();
      setCompanies((data || []).map((item: any) => ({ id: item.id, name: item.name })));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar empresas');
    }
  };

  const handleCreateUser = async () => {
    const trimmedEmail = formData.email.trim().toLowerCase();
    const trimmedName = formData.full_name.trim();
    const trimmedPassword = formData.password;

    if (!trimmedEmail || !trimmedPassword || !trimmedName) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (trimmedPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    const selectedRoleConfig = ROLES_OPTIONS.find((r) => r.value === formData.role);
    if (selectedRoleConfig?.requiresCompany && !formData.company_id) {
      toast.error('Selecione uma empresa para este tipo de usuário');
      return;
    }

    setCreating(true);

    try {
      await adminService.criarUsuario({
        email: trimmedEmail,
        password: trimmedPassword,
        name: trimmedName,
        role: formData.role,
        company_id: selectedRoleConfig?.requiresCompany ? formData.company_id : null,
      });

      toast.success('Usuário criado com sucesso');
      setIsCreateDialogOpen(false);
      setFormData({
        email: '',
        full_name: '',
        password: '',
        role: 'FUNCIONARIO_EMPRESA',
        company_id: '',
      });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user: UserWithRole) => {
    try {
      await adminService.alternarStatusUsuario(user.id);
      toast.success(user.is_active ? 'Usuário desativado' : 'Usuário ativado');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao alterar status do usuário');
    }
  };

  const handleChangeRole = async (user: UserWithRole, newRole: UserRole) => {
    const selectedRoleConfig = ROLES_OPTIONS.find((r) => r.value === newRole);
    const currentCompanyId = user.roles[0]?.company_id || null;

    if (selectedRoleConfig?.requiresCompany && !currentCompanyId) {
      toast.error('Este usuário não possui empresa vinculada para esse perfil');
      return;
    }

    try {
      await adminService.alterarPerfilUsuario(user.id, {
        role: newRole,
        company_id: selectedRoleConfig?.requiresCompany ? currentCompanyId : null,
      });
      toast.success('Perfil alterado com sucesso');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao alterar perfil');
    }
  };

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchesSearch =
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.name.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesRole = roleFilter === 'all' || user.roles.some((r) => r.role === roleFilter);
        return matchesSearch && matchesRole;
      }),
    [users, searchTerm, roleFilter]
  );

  const getRoleBadgeClass = (role: UserRole) => {
    return ROLE_COLORS[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Gerenciamento de Usuários
          </h1>
          <p className="text-muted-foreground">Crie, edite e gerencie usuários da plataforma</p>
        </div>

        {isEvolutechTeam && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="glow" className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] flex flex-col max-h-[85vh]">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>Cadastre um novo usuário na plataforma</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4 flex-1 overflow-y-auto min-h-0 pr-2">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="João da Silva"
                  />
                </div>

                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="joao@empresa.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Senha *</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Perfil de Acesso *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: UserRole) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES_OPTIONS.map((role) => (
                        <SelectItem
                          key={role.value}
                          value={role.value}
                          disabled={role.value === 'SUPER_ADMIN_EVOLUTECH' && !isSuperAdmin}
                        >
                          <div className="flex flex-col">
                            <span>{role.label}</span>
                            <span className="text-xs text-muted-foreground">{role.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {ROLES_OPTIONS.find((r) => r.value === formData.role)?.requiresCompany && (
                  <div className="space-y-2">
                    <Label>Empresa *</Label>
                    <Select value={formData.company_id} onValueChange={(value) => setFormData({ ...formData, company_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-shrink-0 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateUser} disabled={creating}>
                  {creating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Usuário'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[220px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os perfis</SelectItem>
            {ROLES_OPTIONS.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-sm text-muted-foreground">Total de Usuários</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <UserCheck className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users.filter((u) => u.is_active).length}</p>
              <p className="text-sm text-muted-foreground">Ativos</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <Shield className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {users.filter((u) => u.roles.some((r) => ['SUPER_ADMIN_EVOLUTECH', 'ADMIN_EVOLUTECH'].includes(r.role))).length}
              </p>
              <p className="text-sm text-muted-foreground">Evolutech</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
              <Building2 className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {users.filter((u) => u.roles.some((r) => ['DONO_EMPRESA', 'FUNCIONARIO_EMPRESA'].includes(r.role))).length}
              </p>
              <p className="text-sm text-muted-foreground">Empresas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>{filteredUsers.length} usuário(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const primaryRole = user.roles[0]?.role || 'FUNCIONARIO_EMPRESA';
                    const companyName = user.roles[0]?.company_name;

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                              {(user.name || user.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{user.name || 'Sem nome'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeClass(primaryRole)}>{ROLE_LABELS[primaryRole]}</Badge>
                        </TableCell>
                        <TableCell>
                          {companyName ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span>{companyName}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={user.is_active} onCheckedChange={() => handleToggleActive(user)} disabled={user.id === currentUser?.id} />
                            <span className={user.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                              {user.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{new Date(user.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {ROLES_OPTIONS.map((roleOption) => (
                                <DropdownMenuItem
                                  key={`${user.id}-${roleOption.value}`}
                                  onClick={() => handleChangeRole(user, roleOption.value)}
                                  disabled={roleOption.value === primaryRole || (roleOption.value === 'SUPER_ADMIN_EVOLUTECH' && !isSuperAdmin)}
                                >
                                  {`Definir como ${roleOption.label}`}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem disabled>
                                <Mail className="mr-2 h-4 w-4" />
                                Enviar E-mail
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled>
                                <Key className="mr-2 h-4 w-4" />
                                Redefinir Senha
                              </DropdownMenuItem>
                              {isSuperAdmin && user.id !== currentUser?.id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" disabled>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir Usuário
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GerenciarUsuarios;
