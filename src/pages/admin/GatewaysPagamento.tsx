import React, { useEffect, useMemo, useState } from 'react';
import { adminService } from '@/services/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CreditCard, Trash2 } from 'lucide-react';

type Gateway = {
  id: string;
  empresa_id: string;
  provedor: string;
  nome_exibicao: string;
  public_key: string | null;
  secret_key_encrypted: string | null;
  webhook_secret_encrypted?: string | null;
  ambiente: string;
  is_active: boolean;
  webhook_url: string | null;
  company?: { id: string; name: string; status?: string } | null;
};

const providers = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'pagbank', label: 'PagBank' },
];

const GatewaysPagamento: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [form, setForm] = useState({
    empresa_id: '',
    provedor: 'stripe',
    nome_exibicao: '',
    public_key: '',
    secret_key: '',
    webhook_secret: '',
    ambiente: 'sandbox',
    webhook_url: '',
    is_active: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminService.listGateways();
      setGateways(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar gateways');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return gateways;
    return gateways.filter((g) => {
      const companyName = g.company?.name?.toLowerCase() || '';
      return (
        g.nome_exibicao.toLowerCase().includes(term) ||
        g.provedor.toLowerCase().includes(term) ||
        companyName.includes(term)
      );
    });
  }, [search, gateways]);

  const createGateway = async () => {
    if (!form.empresa_id.trim() || !form.provedor.trim() || !form.secret_key.trim()) {
      toast.error('empresa_id, provedor e secret_key sao obrigatorios');
      return;
    }
    setSaving(true);
    try {
      await adminService.createGateway({
        empresa_id: form.empresa_id.trim(),
        provedor: form.provedor,
        nome_exibicao: form.nome_exibicao.trim() || `${form.provedor.toUpperCase()} ${form.empresa_id.slice(0, 6)}`,
        public_key: form.public_key || null,
        secret_key: form.secret_key,
        webhook_secret: form.webhook_secret || null,
        ambiente: form.ambiente,
        webhook_url: form.webhook_url || null,
        is_active: form.is_active,
      });
      toast.success('Gateway criado');
      setForm((old) => ({ ...old, secret_key: '', webhook_secret: '' }));
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao criar gateway');
    } finally {
      setSaving(false);
    }
  };

  const toggleGateway = async (gateway: Gateway) => {
    try {
      await adminService.updateGateway(gateway.id, { is_active: !gateway.is_active });
      toast.success(gateway.is_active ? 'Gateway desativado' : 'Gateway ativado');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar gateway');
    }
  };

  const removeGateway = async (gateway: Gateway) => {
    try {
      await adminService.deleteGateway(gateway.id);
      toast.success('Gateway removido');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao remover gateway');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl flex items-center gap-2">
          <CreditCard className="h-7 w-7 text-primary" />
          Gateways de Pagamento
        </h1>
        <p className="text-muted-foreground">
          Controle dos gateways das empresas pelo painel Evolutech.
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Novo gateway</CardTitle>
          <CardDescription>
            Mesmo fluxo do dono: informar provedor + pk/sk e ativar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Empresa ID</Label>
            <Input
              value={form.empresa_id}
              onChange={(e) => setForm((old) => ({ ...old, empresa_id: e.target.value }))}
              placeholder="UUID da empresa"
            />
          </div>
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select
              value={form.provedor}
              onValueChange={(value) => setForm((old) => ({ ...old, provedor: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nome exibicao</Label>
            <Input
              value={form.nome_exibicao}
              onChange={(e) => setForm((old) => ({ ...old, nome_exibicao: e.target.value }))}
              placeholder="Ex.: Stripe Loja X"
            />
          </div>
          <div className="space-y-2">
            <Label>Public key</Label>
            <Input
              value={form.public_key}
              onChange={(e) => setForm((old) => ({ ...old, public_key: e.target.value }))}
              placeholder="pk_..."
            />
          </div>
          <div className="space-y-2">
            <Label>Secret key</Label>
            <Input
              type="password"
              value={form.secret_key}
              onChange={(e) => setForm((old) => ({ ...old, secret_key: e.target.value }))}
              placeholder="sk_... / token"
            />
          </div>
          <div className="space-y-2">
            <Label>Webhook secret</Label>
            <Input
              type="password"
              value={form.webhook_secret}
              onChange={(e) => setForm((old) => ({ ...old, webhook_secret: e.target.value }))}
              placeholder="whsec_..."
            />
          </div>
          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select
              value={form.ambiente}
              onValueChange={(value) => setForm((old) => ({ ...old, ambiente: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="producao">Producao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              value={form.webhook_url}
              onChange={(e) => setForm((old) => ({ ...old, webhook_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(value) => setForm((old) => ({ ...old, is_active: value }))}
              />
              <span className="text-sm">Ativar ao salvar</span>
            </div>
            <Button onClick={createGateway} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar gateway'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Gateways cadastrados</CardTitle>
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-muted-foreground">Carregando...</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-muted-foreground">Nenhum gateway encontrado.</p>
          )}
          {!loading &&
            filtered.map((gateway) => (
              <div
                key={gateway.id}
                className="rounded-lg border border-border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{gateway.nome_exibicao}</p>
                  <p className="text-sm text-muted-foreground">
                    {gateway.company?.name || gateway.empresa_id} • {gateway.provedor} • {gateway.ambiente}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={gateway.is_active ? 'default' : 'secondary'}>
                    {gateway.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <Switch
                    checked={gateway.is_active}
                    onCheckedChange={() => toggleGateway(gateway)}
                  />
                  <Button size="icon" variant="destructive" onClick={() => removeGateway(gateway)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default GatewaysPagamento;

