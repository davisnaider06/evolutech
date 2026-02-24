import React, { useEffect, useMemo, useState } from 'react';
import { companyService } from '@/services/company';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CreditCard, Link2, Trash2 } from 'lucide-react';

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
};

const providers = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'pagbank', label: 'PagBank' },
] as const;

const GatewaysEmpresa: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [form, setForm] = useState({
    provedor: 'stripe' as 'stripe' | 'mercadopago' | 'pagbank',
    nome_exibicao: '',
    public_key: '',
    secret_key: '',
    webhook_secret: '',
    ambiente: 'sandbox' as 'sandbox' | 'producao',
    webhook_url: '',
  });

  const activeGateway = useMemo(() => gateways.find((g) => g.is_active) || null, [gateways]);

  const loadGateways = async () => {
    setLoading(true);
    try {
      const data = await companyService.listMyGateways();
      setGateways(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar gateways');
      setGateways([]);
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
      await companyService.connectGateway({
        provedor: form.provedor,
        nome_exibicao: form.nome_exibicao || undefined,
        public_key: form.public_key || undefined,
        secret_key: form.secret_key,
        webhook_secret: form.webhook_secret || undefined,
        ambiente: form.ambiente,
        webhook_url: form.webhook_url || undefined,
      });
      toast.success('Gateway conectado com sucesso');
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
          Configure um gateway ativo por vez para PIX e recebimentos automáticos.
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Conectar Gateway
          </CardTitle>
          <CardDescription>
            Após conectar, o gateway será ativado e os demais serão desativados automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select
              value={form.provedor}
              onValueChange={(value: 'stripe' | 'mercadopago' | 'pagbank') =>
                setForm((old) => ({ ...old, provedor: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nome de exibição</Label>
            <Input
              value={form.nome_exibicao}
              onChange={(e) => setForm((old) => ({ ...old, nome_exibicao: e.target.value }))}
              placeholder="Ex.: Stripe Minha Empresa"
            />
          </div>

          <div className="space-y-2">
            <Label>Public Key (opcional)</Label>
            <Input
              value={form.public_key}
              onChange={(e) => setForm((old) => ({ ...old, public_key: e.target.value }))}
              placeholder="pk_..."
            />
          </div>

          <div className="space-y-2">
            <Label>Secret Key</Label>
            <Input
              value={form.secret_key}
              onChange={(e) => setForm((old) => ({ ...old, secret_key: e.target.value }))}
              placeholder="sk_... / access token"
              type="password"
            />
          </div>

          <div className="space-y-2">
            <Label>Webhook Secret (opcional)</Label>
            <Input
              value={form.webhook_secret}
              onChange={(e) => setForm((old) => ({ ...old, webhook_secret: e.target.value }))}
              placeholder="whsec_..."
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

          <div className="space-y-2 md:col-span-2">
            <Label>Webhook URL (opcional)</Label>
            <Input
              value={form.webhook_url}
              onChange={(e) => setForm((old) => ({ ...old, webhook_url: e.target.value }))}
              placeholder="https://api.seudominio.com/webhook"
            />
          </div>

          <div className="md:col-span-2">
            <Button onClick={connectGateway} disabled={saving} className="w-full sm:w-auto">
              <CreditCard className="h-4 w-4 mr-2" />
              {saving ? 'Conectando...' : 'Conectar Gateway'}
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
                <div>
                  <p className="font-medium">{gateway.nome_exibicao}</p>
                  <p className="text-sm text-muted-foreground">
                    {gateway.provedor} • {gateway.ambiente}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    SK: {gateway.secret_key_masked || 'não informada'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={gateway.is_active ? 'default' : 'secondary'}>
                    {gateway.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {!gateway.is_active && (
                    <Button variant="outline" size="sm" onClick={() => activateGateway(gateway.id)}>
                      Ativar
                    </Button>
                  )}
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

