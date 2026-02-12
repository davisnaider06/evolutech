import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Plus, Mail, Trash2, Clock, CheckCircle, XCircle, UserPlus, Copy, Send } from 'lucide-react';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  role: z.enum(['funcionario_empresa', 'dono_empresa']),
});

interface Invite {
  id: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  expires_at: string;
  token: string;
}

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

export default function ConvitesEquipe() {
  const { user, company } = useAuth();
  const { logAudit } = useAuditLog();
  const { toast } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    role: 'funcionario_empresa' as 'funcionario_empresa' | 'dono_empresa',
  });

  useEffect(() => {
    if (company) {
      fetchInvites();
      fetchMembers();
    }
  }, [company]);

  const fetchInvites = async () => {
    if (!company) return;
    
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });

    if (!error) {
      setInvites(data || []);
    }
    setLoading(false);
  };

  const fetchMembers = async () => {
    if (!company) return;

    // Get all users with roles in this company
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('company_id', company.id);

    if (!roleData?.length) return;

    const userIds = roleData.map(r => r.user_id);
    
    // Get profiles for these users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .in('id', userIds);

    if (profiles) {
      const membersWithRoles = profiles.map(profile => {
        const roleInfo = roleData.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: roleInfo?.role || 'funcionario_empresa',
        };
      });
      setMembers(membersWithRoles);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = inviteSchema.safeParse(formData);
    if (!result.success) {
      toast({ title: result.error.errors[0].message, variant: 'destructive' });
      return;
    }

    if (!company || !user) return;

    setIsSending(true);
    try {
      // Check if email already invited or is a member
      const existingInvite = invites.find(i => i.email === formData.email && i.status === 'pending');
      if (existingInvite) {
        toast({ title: 'Este email já possui um convite pendente', variant: 'destructive' });
        return;
      }

      const existingMember = members.find(m => m.email === formData.email);
      if (existingMember) {
        toast({ title: 'Este email já faz parte da equipe', variant: 'destructive' });
        return;
      }

      // Create invitation
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          email: formData.email,
          role: formData.role,
          company_id: company.id,
          invited_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await logAudit({ 
        action: 'invite', 
        entityType: 'invitations', 
        entityId: data.id, 
        details: { email: formData.email, role: formData.role } 
      });

      toast({ title: 'Convite enviado com sucesso!' });
      setIsDialogOpen(false);
      setFormData({ email: '', role: 'funcionario_empresa' });
      fetchInvites();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar convite';
      toast({ title: message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteInvite = async (invite: Invite) => {
    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invite.id);

    if (error) {
      toast({ title: 'Erro ao excluir convite', variant: 'destructive' });
    } else {
      await logAudit({ action: 'delete', entityType: 'invitations', entityId: invite.id, details: { email: invite.email } });
      toast({ title: 'Convite excluído' });
      fetchInvites();
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/aceitar-convite?token=${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!' });
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (isExpired) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Expirado</Badge>;
    }
    
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
      case 'active':
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Aceito</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'dono_empresa':
        return 'Administrador';
      case 'funcionario_empresa':
        return 'Funcionário';
      default:
        return role;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Equipe</h1>
          <p className="text-muted-foreground">Gerencie os membros e convites da sua empresa</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Convidar Membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Novo Membro</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v: 'funcionario_empresa' | 'dono_empresa') => 
                    setFormData({ ...formData, role: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="funcionario_empresa">Funcionário</SelectItem>
                    <SelectItem value="dono_empresa">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isSending}>
                {isSending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar Convite
                  </>
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Membros da Equipe
          </CardTitle>
          <CardDescription>Usuários ativos na sua empresa</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum membro cadastrado além de você
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name || 'Não informado'}
                      {member.id === user?.id && (
                        <Badge variant="outline" className="ml-2">Você</Badge>
                      )}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'dono_empresa' ? 'default' : 'secondary'}>
                        {getRoleLabel(member.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Invites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Convites Pendentes
          </CardTitle>
          <CardDescription>Convites enviados aguardando aceite</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : invites.filter(i => i.status === 'pending').length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum convite pendente
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.filter(i => i.status === 'pending').map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getRoleLabel(invite.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(invite.status, invite.expires_at)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyInviteLink(invite.token)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleDeleteInvite(invite)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
