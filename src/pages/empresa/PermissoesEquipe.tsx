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

// Chaves que nao mudam nada para o funcionario: telas so do dono
// (painel, permissoes, comissao do dono, fidelidade), coisa do cliente final
// (portal), suporte (liberado para toda a equipe) e modulo sem tela
// (comandas). Mostra-las fazia o dono desligar algo e nada acontecer.
const SEM_EFEITO_PARA_FUNCIONARIO = new Set([
  'dashboard',
  'permissions',
  'permissoes',
  'controle_permissoes',
  'comissoes_dono',
  'commissions_owner',
  'fidelidade',
  'loyalty',
  'customer_portal',
  'portal_cliente',
  'support',
  'suporte',
]);

// O catalogo chama o modulo `pedidos` de "Comandas", e o menu chama de
// "Pedidos": o dono desligava "Comandas" sem saber que era a tela de Pedidos.
const NOME_NO_MENU: Record<string, string> = {
  pedidos: 'Pedidos',
  orders: 'Pedidos',
  commissions_staff: 'Minhas comissões',
  agendamentos: 'Agenda',
};
const nomeDoModulo = (permission: ModulePermission) =>
  NOME_NO_MENU[String(permission.modulo_codigo || '').toLowerCase()] || permission.modulo_nome;

// Perfis prontos: o dono escolhe "Barbeiro" em vez de configurar chave por
// chave. O que nao esta no perfil fica desligado — o padrao antigo era tudo
// ligado, e o barbeiro novo ja via e mexia no caixa.
const PERFIS: Array<{ id: string; nome: string; descricao: string; codigos: string[] | 'todos' }> = [
  {
    id: 'barbeiro',
    nome: 'Barbeiro',
    descricao: 'Agenda, clientes, a própria comissão e vender no PDV.',
    codigos: ['agendamentos', 'appointments', 'clientes', 'customers', 'commissions_staff', 'comissoes', 'commissions', 'pdv'],
  },
  {
    id: 'recepcao',
    nome: 'Recepção',
    descricao: 'Tudo do barbeiro, mais caixa, vendas, produtos, mensalidades e cobranças.',
    codigos: [
      'agendamentos', 'appointments', 'clientes', 'customers', 'pdv', 'caixa', 'cash',
      'pedidos', 'orders', 'produtos', 'products', 'estoque', 'inventory',
      'assinaturas', 'subscriptions', 'collections', 'cobrancas', 'billing',
    ],
  },
  { id: 'gerente', nome: 'Gerente', descricao: 'Acesso a todas as áreas da empresa.', codigos: 'todos' },
];

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

  const visiveis = (member: TeamMemberPermissions) =>
    member.permissions.filter(
      (permission) => !SEM_EFEITO_PARA_FUNCIONARIO.has(String(permission.modulo_codigo || '').toLowerCase())
    );

  const perfilAtual = (member: TeamMemberPermissions) => {
    const lista = visiveis(member);
    return PERFIS.find((perfil) =>
      lista.every((permission) => {
        const noPerfil =
          perfil.codigos === 'todos' ||
          perfil.codigos.includes(String(permission.modulo_codigo || '').toLowerCase());
        return permission.is_allowed === noPerfil;
      })
    )?.id;
  };

  const aplicarPerfil = async (member: TeamMemberPermissions, perfilId: string) => {
    const perfil = PERFIS.find((item) => item.id === perfilId);
    if (!perfil) return;
    const alteracoes = visiveis(member).map((permission) => ({
      modulo_id: permission.modulo_id,
      modulo_codigo: permission.modulo_codigo,
      is_allowed:
        perfil.codigos === 'todos' ||
        perfil.codigos.includes(String(permission.modulo_codigo || '').toLowerCase()),
    }));

    setSavingMemberId(member.id);
    try {
      await companyService.updateTeamMemberPermissions(member.id, alteracoes);
      setData((prev) => ({
        ...prev,
        members: prev.members.map((item) =>
          item.id !== member.id
            ? item
            : {
                ...item,
                permissions: item.permissions.map((permission) => {
                  const nova = alteracoes.find((alteracao) => alteracao.modulo_id === permission.modulo_id);
                  return nova ? { ...permission, is_allowed: nova.is_allowed } : permission;
                }),
              }
        ),
      }));
      toast.success(`${member.full_name} agora tem o perfil ${perfil.nome}`);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao aplicar perfil');
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
            Escolha um perfil para cada pessoa da equipe. Se precisar, ajuste área por área.
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>O que cada um pode acessar</CardTitle>
          <CardDescription>
            Vale para os funcionários. Você, como dono, sempre tem acesso a tudo.
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

                  <div className="mb-3 grid gap-2 sm:grid-cols-3">
                    {PERFIS.map((perfil) => {
                      const ativo = perfilAtual(member) === perfil.id;
                      return (
                        <button
                          key={perfil.id}
                          type="button"
                          disabled={savingMemberId === member.id}
                          onClick={() => aplicarPerfil(member, perfil.id)}
                          aria-pressed={ativo}
                          className={`rounded-md border px-3 py-2 text-left transition-colors ${
                            ativo ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60'
                          }`}
                        >
                          <span className="block text-sm font-semibold">
                            {perfil.nome}
                            {ativo && <span className="ml-2 text-xs font-normal text-primary">em uso</span>}
                          </span>
                          <span className="block text-xs text-muted-foreground">{perfil.descricao}</span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mb-2 text-xs text-muted-foreground">
                    {perfilAtual(member) ? 'Ajuste fino:' : 'Personalizado:'}
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {visiveis(member).map((permission) => (
                      <div
                        key={`${member.id}:${permission.modulo_id}`}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                      >
                        <span className="text-sm">{nomeDoModulo(permission)}</span>
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
