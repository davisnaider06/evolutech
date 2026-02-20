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
import { UserPlus, Copy } from 'lucide-react';

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
  const [isCreating, setIsCreating] = useState(false);
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
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

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = formData.fullName.trim();
    const email = formData.email.trim().toLowerCase();

    if (!fullName || !email) {
      toast.error('Preencha nome e e-mail');
      return;
    }

    setIsCreating(true);
    try {
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
      setIsDialogOpen(false);
      setFormData({ fullName: '', email: '', password: '' });
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cadastrar membro');
    } finally {
      setIsCreating(false);
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
          <p className="text-muted-foreground">Cadastre funcionários e gerencie acessos da sua empresa</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Cadastrar Membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Funcionário</DialogTitle>
              <DialogDescription>
                O novo usuário será criado com nível de acesso Funcionário.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateMember} className="space-y-4">
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
                <Label>Senha inicial (opcional)</Label>
                <Input
                  placeholder="Se vazio, gera senha temporária"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating ? 'Cadastrando...' : 'Cadastrar Funcionário'}
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
          <CardDescription>Usuários ativos na sua empresa</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum membro cadastrado
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.fullName}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'DONO_EMPRESA' ? 'default' : 'secondary'}>
                        {member.role === 'DONO_EMPRESA' ? 'Administrador' : 'Funcionário'}
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
            <DialogTitle>Acesso do Funcionário</DialogTitle>
            <DialogDescription>Envie esses dados para o novo membro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><strong>Email:</strong> {credentials?.email}</p>
            <p><strong>Senha temporária:</strong> {credentials?.temporaryPassword}</p>
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
