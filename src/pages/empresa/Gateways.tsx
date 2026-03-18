import React, { useEffect, useMemo, useState } from 'react';
import { companyService } from '@/services/company';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CreditCard, Link2, Search, Trash2 } from 'lucide-react';

type Gateway = {
  id: string;
  provedor: string;
  nome_exibicao: string;
  public_key: string | null;
  secret_key_masked: string | null;
  webhook_secret_masked: string | null;
  ambiente: string;
  is_active: boolean;
  webhook_url: string | null;
  support_level?: 'supported' | 'planned';
  automatic_supported?: boolean;
};

type GatewayCatalogItem = {
  value: string;
  label: string;
  region?: string;
  supportLevel: 'supported' | 'planned';
};

const GatewaysEmpresa: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [catalog, setCatalog] = useState<GatewayCatalogItem[]>([]);
  const [providerSearch, setProviderSearch] = useState('');
  const [form, setForm] = useState({
    provedor: 'stripe',
    nome_exibicao: '',
    public_key: '',
    secret_key: '',
    webhook_secret: '',
    ambiente: 'sandbox' as 'sandbox' | 'producao',
    webhook_url: '',
  });

  const activeGateway = useMemo(() => gateways.find((g) => g.is_active) || null, [gateways]);

  const filteredCatalog = useMemo(() => {
    const search = String(providerSearch || '').trim().toLowerCase();
    return catalog.filter((item) => {
      if (!search) return true;
      return (
        item.label.toLowerCase().includes(search) ||
        item.value.toLowerCase().includes(search) ||
        String(item.region || '').toLowerCase().includes(search)
      );
    });
  }, [catalog, providerSearch]);

  const selectedProvider = useMemo(
    () => catalog.find((item) => item.value === form.provedor) || null,
    [catalog, form.provedor]
  );

  const loadGateways = async () => {
    setLoading(true);
    try {
      const [gatewaysData, catalogData] = await Promise.all([
        companyService.listMyGateways(),
        companyService.listGatewayCatalog(),
      ]);
      setGateways(Array.isArray(gatewaysData) ? gatewaysData : []);
      setCatalog(Array.isArray(catalogData) ? catalogData : []);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar gateways');
      setGateways([]);
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGateways();
  }, []);

  const connectGateway = async () => {
    if (!form.secret_key.trim()) {
      toast.error('Informe a secret key');
      return;
    }

    setSaving(true);
    try {
      const result = await companyService.connectGateway({
        provedor: form.provedor,
        nome_exibicao: form.nome_exibicao || undefined,
        public_key: form.public_key || undefined,
        secret_key: form.secret_key,
        webhook_secret: form.webhook_secret || undefined,
        ambiente: form.ambiente,
        webhook_url: form.webhook_url || undefined,
      });
      toast.success(result?.message || 'Gateway salvo com sucesso');
      setForm((old) => ({ ...old, secret_key: '', webhook_secret: '' }));
      await loadGateways();
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao conectar gateway');
    } finally {
      setSaving(false);
    }
  };

  const activateGateway = async (gatewayId: string) => {
    try {
      await companyService.activateGateway(gatewayId);
      toast.success('Gateway ativado');
      await loadGateways();
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao ativar gateway');
    }
  };

  const removeGateway = async (gatewayId: string) => {
    try {
      await companyService.deleteGateway(gatewayId);
      toast.success('Gateway removido');
      await loadGateways();
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao remover gateway');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">Gateways de Pagamento</h1>
        <p className="text-muted-foreground">
          Selecione um gateway do catálogo, salve as credenciais e ative automaticamente apenas os provedores já integrados.
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Catálogo de gateways
          </CardTitle>
          <CardDescription>
            O sistema já integra automaticamente Stripe, Mercado Pago e PagBank. Os demais podem ser cadastrados agora e integrados sob demanda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Buscar gateway</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  placeholder="Ex.: Cielo, PayPal, Adyen..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select
                value={form.provedor}
                onValueChange={(value: string) => setForm((old) => ({ ...old, provedor: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {filteredCatalog.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label} {item.supportLevel === 'supported' ? '• Suportado' : '• Sob demanda'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedProvider ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
              <p className="font-medium">{selectedProvider.label}</p>
              {selectedProvider.region ? <Badge variant="outline">{selectedProvider.region}</Badge> : null}
              <Badge variant={selectedProvider.supportLevel === 'supported' ? 'default' : 'secondary'}>
                {selectedProvider.supportLevel === 'supported' ? 'Integração automática' : 'Integração sob demanda'}
              </Badge>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome de exibição</Label>
              <Input
                value={form.nome_exibicao}
                onChange={(e) => setForm((old) => ({ ...old, nome_exibicao: e.target.value }))}
                placeholder="Ex.: Gateway principal da empresa"
              />
            </div>

            <div className="space-y-2">
              <Label>Public Key (opcional)</Label>
              <Input
                value={form.public_key}
                onChange={(e) => setForm((old) => ({ ...old, public_key: e.target.value }))}
                placeholder="pk_... / chave pública"
              />
            </div>

            <div className="space-y-2">
              <Label>Secret Key / Token</Label>
              <Input
                value={form.secret_key}
                onChange={(e) => setForm((old) => ({ ...old, secret_key: e.target.value }))}
                placeholder="sk_... / access token / token privado"
                type="password"
              />
            </div>

            <div className="space-y-2">
              <Label>Webhook Secret (opcional)</Label>
              <Input
                value={form.webhook_secret}
                onChange={(e) => setForm((old) => ({ ...old, webhook_secret: e.target.value }))}
                placeholder="Segredo de assinatura"
                type="password"
              />
            </div>

            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select
                value={form.ambiente}
                onValueChange={(value: 'sandbox' | 'producao') =>
                  setForm((old) => ({ ...old, ambiente: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Webhook URL (opcional)</Label>
              <Input
                value={form.webhook_url}
                onChange={(e) => setForm((old) => ({ ...old, webhook_url: e.target.value }))}
                placeholder="https://api.seudominio.com/webhook"
              />
            </div>
          </div>

          <div>
            <Button onClick={connectGateway} disabled={saving} className="w-full sm:w-auto">
              <CreditCard className="mr-2 h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar gateway'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Gateways configurados</CardTitle>
          <CardDescription>
            Atualmente ativo: {activeGateway ? activeGateway.nome_exibicao : 'nenhum'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-muted-foreground">Carregando...</p>}
          {!loading && gateways.length === 0 && (
            <p className="text-muted-foreground">Nenhum gateway configurado.</p>
          )}
          {!loading &&
            gateways.map((gateway) => (
              <div
                key={gateway.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{gateway.nome_exibicao}</p>
                    <Badge variant={gateway.automatic_supported ? 'default' : 'secondary'}>
                      {gateway.automatic_supported ? 'Automático' : 'Sob demanda'}
                    </Badge>
                    <Badge variant="outline">{gateway.ambiente}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {gateway.provedor}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Token: {gateway.secret_key_masked || 'não informado'}
                  </p>
                  {!gateway.automatic_supported ? (
                    <p className="text-xs text-amber-500">
                      Este gateway foi salvo no catálogo, mas ainda não possui ativação automática no sistema.
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={gateway.is_active ? 'default' : 'secondary'}>
                    {gateway.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {!gateway.is_active && gateway.automatic_supported ? (
                    <Button variant="outline" size="sm" onClick={() => activateGateway(gateway.id)}>
                      Ativar
                    </Button>
                  ) : null}
                  <Button variant="destructive" size="icon" onClick={() => removeGateway(gateway.id)}>
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

export default GatewaysEmpresa;
