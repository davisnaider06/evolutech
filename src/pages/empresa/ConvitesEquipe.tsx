import React, { useEffect, useState } from 'react';
import { companyService } from '@/services/company';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserPlus, Copy, Pencil, Trash2 } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  fullName: string;
  role: 'DONO_EMPRESA' | 'FUNCIONARIO_EMPRESA';
  isActive: boolean;
  createdAt: string;
}

interface AccessCredentials {
  email: string;
  temporaryPassword: string;
}

export default function ConvitesEquipe() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    isActive: true,
  });

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const data = await companyService.listTeamMembers();
      setMembers(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar membros da equipe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const resetForm = () => {
    setEditingMemberId(null);
    setFormData({
      fullName: '',
      email: '',
      password: '',
      isActive: true,
    });
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setFormData({
      fullName: member.fullName,
      email: member.email,
      password: '',
      isActive: member.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = formData.fullName.trim();
    const email = formData.email.trim().toLowerCase();

    if (!fullName || !email) {
      toast.error('Preencha nome e e-mail');
      return;
    }

    setIsSaving(true);
    try {
      if (editingMemberId) {
        await companyService.updateTeamMember(editingMemberId, {
          fullName,
          email,
          password: formData.password.trim() || undefined,
          isActive: formData.isActive,
        });
        toast.success('Membro atualizado com sucesso');
      } else {
        const result = await companyService.createTeamMember({
          fullName,
          email,
          password: formData.password.trim() || undefined,
        });
        setCredentials({
          email: result.credentials.email,
          temporaryPassword: result.credentials.temporaryPassword,
        });
        toast.success('Membro cadastrado com sucesso');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar membro');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (member: TeamMember) => {
    const confirmed = window.confirm(`Excluir ${member.fullName} da equipe?`);
    if (!confirmed) return;

    setDeletingMemberId(member.id);
    try {
      await companyService.deleteTeamMember(member.id);
      toast.success('Membro removido da equipe');
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir membro');
    } finally {
      setDeletingMemberId(null);
    }
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    const payload = `Email: ${credentials.email}\nSenha temporaria: ${credentials.temporaryPassword}`;
    await navigator.clipboard.writeText(payload);
    toast.success('Credenciais copiadas');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Equipe</h1>
          <p className="text-muted-foreground">Cadastre, edite e remova funcionarios da sua empresa</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreate}>
              <UserPlus className="h-4 w-4" />
              Cadastrar Membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMemberId ? 'Editar Membro' : 'Cadastrar Novo Funcionario'}</DialogTitle>
              <DialogDescription>
                {editingMemberId
                  ? 'Atualize os dados do funcionario.'
                  : 'O novo usuario sera criado com nivel de acesso Funcionario.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveMember} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  placeholder="Nome completo"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{editingMemberId ? 'Nova senha (opcional)' : 'Senha inicial (opcional)'}</Label>
                <Input
                  placeholder={editingMemberId ? 'Se vazio, mantem a senha atual' : 'Se vazio, gera senha temporaria'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              {editingMemberId && (
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Funcionario ativo</p>
                    <p className="text-xs text-muted-foreground">Desative para bloquear o acesso sem excluir</p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? 'Salvando...' : editingMemberId ? 'Salvar Alteracoes' : 'Cadastrar Funcionario'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Membros da Equipe
          </CardTitle>
          <CardDescription>Usuarios vinculados a sua empresa</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum membro cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Funcao</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.fullName}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'DONO_EMPRESA' ? 'default' : 'secondary'}>
                        {member.role === 'DONO_EMPRESA' ? 'Administrador' : 'Funcionario'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={member.isActive} disabled />
                        <span className={member.isActive ? 'text-green-600' : 'text-muted-foreground'}>
                          {member.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.createdAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.role === 'FUNCIONARIO_EMPRESA' ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(member)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(member)}
                            disabled={deletingMemberId === member.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Dono principal</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!credentials} onOpenChange={() => setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acesso do Funcionario</DialogTitle>
            <DialogDescription>Envie esses dados para o novo membro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><strong>Email:</strong> {credentials?.email}</p>
            <p><strong>Senha temporaria:</strong> {credentials?.temporaryPassword}</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={copyCredentials}>
            <Copy className="h-4 w-4" />
            Copiar Acesso
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
