import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
import { useAuditLog } from '@/hooks/useAuditLog';
import { ROLE_LABELS, ROLE_COLORS, UserRole, DbRole, dbRoleToUserRole, userRoleToDbRole } from '@/types/auth';
import { 
  Users, 
  Plus, 
  Search, 
  MoreVertical,
  Mail,
  Building2,
  Shield,
  UserCheck,
  UserX,
  Key,
  Trash2,
  RefreshCw,
  Filter
} from 'lucide-react';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  company?: {
    id: string;
    name: string;
  } | null;
  roles: {
    role: DbRole;
    company_id: string | null;
  }[];
}

interface Company {
  id: string;
  name: string;
}

const ROLES_OPTIONS: { value: DbRole; label: string; description: string; requiresCompany: boolean }[] = [
  { 
    value: 'super_admin_evolutech', 
    label: 'Super Admin Evolutech', 
    description: 'Acesso total à plataforma',
    requiresCompany: false 
  },
  { 
    value: 'admin_evolutech', 
    label: 'Admin Evolutech', 
    description: 'Administrador da Evolutech',
    requiresCompany: false 
  },
  { 
    value: 'dono_empresa', 
    label: 'Dono da Empresa', 
    description: 'Proprietário de uma empresa cliente',
    requiresCompany: true 
  },
  { 
    value: 'funcionario_empresa', 
    label: 'Funcionário', 
    description: 'Funcionário de uma empresa',
    requiresCompany: true 
  },
];

const GerenciarUsuarios: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const { logAudit } = useAuditLog();
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
    role: 'funcionario_empresa' as DbRole,
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
      // Fetch profiles with roles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          is_active,
          company_id,
          created_at,
          updated_at,
          company:companies(id, name)
        `)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, company_id');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profilesData || []).map(profile => ({
        ...profile,
        roles: (rolesData || [])
          .filter(r => r.user_id === profile.id)
          .map(r => ({ role: r.role as DbRole, company_id: r.company_id }))
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
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

    // Validate email format - only ASCII characters allowed (Supabase Auth requirement)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error('E-mail inválido. Use apenas letras sem acentos, números e caracteres permitidos (. _ % + -)');
      return;
    }

    if (trimmedPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    const selectedRoleConfig = ROLES_OPTIONS.find(r => r.value === formData.role);
    if (selectedRoleConfig?.requiresCompany && !formData.company_id) {
      toast.error('Selecione uma empresa para este tipo de usuário');
      return;
    }

    setCreating(true);

    try {
      // Call edge function to create user
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: trimmedEmail,
          password: trimmedPassword,
          full_name: trimmedName,
          role: formData.role,
          company_id: selectedRoleConfig?.requiresCompany ? formData.company_id : null,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await logAudit({
        action: 'create',
        entityType: 'user',
        entityId: data?.userId,
        companyId: formData.company_id || undefined,
        details: { 
          email: formData.email, 
          role: formData.role 
        },
      });

      toast.success('Usuário criado com sucesso!');
      setIsCreateDialogOpen(false);
      setFormData({
        email: '',
        full_name: '',
        password: '',
        role: 'funcionario_empresa',
        company_id: '',
      });
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user: UserWithRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;

      await logAudit({
        action: user.is_active ? 'deactivate' : 'activate',
        entityType: 'user',
        entityId: user.id,
        companyId: user.company_id || undefined,
        details: { email: user.email },
      });

      toast.success(user.is_active ? 'Usuário desativado' : 'Usuário ativado');
      fetchUsers();
    } catch (error) {
      console.error('Error toggling user:', error);
      toast.error('Erro ao alterar status do usuário');
    }
  };

  const handleChangeRole = async (user: UserWithRole, newRole: DbRole) => {
    const selectedRoleConfig = ROLES_OPTIONS.find(r => r.value === newRole);
    
    try {
      // Delete existing roles
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Insert new role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: newRole,
          company_id: selectedRoleConfig?.requiresCompany ? user.company_id : null,
        });

      if (insertError) throw insertError;

      await logAudit({
        action: 'role_change',
        entityType: 'user',
        entityId: user.id,
        companyId: user.company_id || undefined,
        details: { 
          email: user.email,
          oldRole: user.roles[0]?.role,
          newRole: newRole,
        },
      });

      toast.success('Perfil alterado com sucesso');
      fetchUsers();
    } catch (error) {
      console.error('Error changing role:', error);
      toast.error('Erro ao alterar perfil');
    }
  };

  const getUserPrimaryRole = (user: UserWithRole): UserRole => {
    if (user.roles.length === 0) return 'FUNCIONARIO_EMPRESA';
    return dbRoleToUserRole(user.roles[0].role);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesRole = roleFilter === 'all' || user.roles.some(r => r.role === roleFilter);
    
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeClass = (role: UserRole) => {
    return ROLE_COLORS[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold lg:text-3xl flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Gerenciamento de Usuários
          </h1>
          <p className="text-muted-foreground">
            Crie, edite e gerencie usuários da plataforma
          </p>
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
                <DialogDescription>
                  Cadastre um novo usuário na plataforma
                </DialogDescription>
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
                    onValueChange={(value: DbRole) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES_OPTIONS.map((role) => (
                        <SelectItem 
                          key={role.value} 
                          value={role.value}
                          disabled={role.value === 'super_admin_evolutech' && !isSuperAdmin}
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

                {ROLES_OPTIONS.find(r => r.value === formData.role)?.requiresCompany && (
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

      {/* Filters */}
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
          <SelectTrigger className="w-[200px]">
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

      {/* Stats */}
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
              <p className="text-2xl font-bold">{users.filter(u => u.is_active).length}</p>
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
                {users.filter(u => u.roles.some(r => ['super_admin_evolutech', 'admin_evolutech'].includes(r.role))).length}
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
                {users.filter(u => u.roles.some(r => ['dono_empresa', 'funcionario_empresa'].includes(r.role))).length}
              </p>
              <p className="text-sm text-muted-foreground">Empresas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>
            {filteredUsers.length} usuário(s) encontrado(s)
          </CardDescription>
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
                    const primaryRole = getUserPrimaryRole(user);
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                              {(user.full_name || user.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{user.full_name || 'Sem nome'}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeClass(primaryRole)}>
                            {ROLE_LABELS[primaryRole]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.company ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span>{user.company.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={user.is_active}
                              onCheckedChange={() => handleToggleActive(user)}
                              disabled={user.id === currentUser?.id}
                            />
                            <span className={user.is_active ? 'text-green-600' : 'text-muted-foreground'}>
                              {user.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled>
                                <Mail className="mr-2 h-4 w-4" />
                                Enviar E-mail
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled>
                                <Key className="mr-2 h-4 w-4" />
                                Redefinir Senha
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {isSuperAdmin && user.id !== currentUser?.id && (
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  disabled
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir Usuário
                                </DropdownMenuItem>
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
