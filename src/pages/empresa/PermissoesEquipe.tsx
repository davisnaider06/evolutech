import React, { useEffect, useMemo, useState } from 'react';
import { companyService } from '@/services/company';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type ModulePermission = {
  modulo_id: string;
  modulo_codigo: string;
  modulo_nome: string;
  is_allowed: boolean;
};

type TeamMemberPermissions = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  permissions: ModulePermission[];
};

type TeamPermissionsResponse = {
  modules: Array<{
    id: string;
    codigo: string;
    nome: string;
    is_pro: boolean;
  }>;
  members: TeamMemberPermissions[];
};

export default function PermissoesEquipe() {
  const [loading, setLoading] = useState(true);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [data, setData] = useState<TeamPermissionsResponse>({ modules: [], members: [] });

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await companyService.listTeamPermissions();
      setData(response || { modules: [], members: [] });
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar permissões da equipe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const sortedMembers = useMemo(
    () => [...data.members].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [data.members]
  );

  const togglePermission = async (memberId: string, permission: ModulePermission, nextAllowed: boolean) => {
    setSavingMemberId(memberId);
    try {
      await companyService.updateTeamMemberPermissions(memberId, [
        {
          modulo_id: permission.modulo_id,
          modulo_codigo: permission.modulo_codigo,
          is_allowed: nextAllowed,
        },
      ]);

      setData((prev) => ({
        ...prev,
        members: prev.members.map((member) =>
          member.id !== memberId
            ? member
            : {
                ...member,
                permissions: member.permissions.map((item) =>
                  item.modulo_id === permission.modulo_id
                    ? { ...item, is_allowed: nextAllowed }
                    : item
                ),
              }
        ),
      }));
      toast.success('Permissão atualizada');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar permissão');
    } finally {
      setSavingMemberId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Permissões da Equipe</h1>
          <p className="text-muted-foreground">
            Defina quais módulos cada funcionário pode acessar.
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Módulos por Funcionário</CardTitle>
          <CardDescription>
            Permissões aplicam somente para `FUNCIONARIO_EMPRESA`. Dono sempre mantém acesso administrativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando permissões...</p>
          ) : sortedMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
          ) : (
            <div className="space-y-4">
              {sortedMembers.map((member) => (
                <div key={member.id} className="rounded-lg border border-border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{member.full_name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                    <Badge variant={member.is_active ? 'default' : 'secondary'}>
                      {member.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    {member.permissions.map((permission) => (
                      <div
                        key={`${member.id}:${permission.modulo_id}`}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                      >
                        <span className="text-sm">{permission.modulo_nome}</span>
                        <Switch
                          checked={permission.is_allowed}
                          disabled={savingMemberId === member.id}
                          onCheckedChange={(checked) =>
                            togglePermission(member.id, permission, checked)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
