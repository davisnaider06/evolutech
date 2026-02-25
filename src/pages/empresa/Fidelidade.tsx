import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/crud/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { companyService } from '@/services/company';
import { toast } from 'sonner';

interface LoyaltySettings {
  points_per_service: number;
  cashback_percent: number;
  tenth_service_free: boolean;
  point_value: number;
  is_active: boolean;
}

interface LoyaltyProfileResponse {
  customer?: { id: string; name: string };
  profile?: {
    points_balance: number;
    cashback_balance: number;
    total_points_earned: number;
    total_points_redeemed: number;
    total_cashback_earned: number;
    total_cashback_used: number;
    total_services_count: number;
  };
  transactions?: Array<{
    id: string;
    transaction_type: string;
    points_delta: number;
    cashback_delta: number;
    amount_reference: number;
    notes?: string | null;
    created_at: string;
  }>;
}

const defaultSettings: LoyaltySettings = {
  points_per_service: 1,
  cashback_percent: 0,
  tenth_service_free: true,
  point_value: 1,
  is_active: true,
};

const toMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const Fidelidade: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<LoyaltySettings>(defaultSettings);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<LoyaltyProfileResponse | null>(null);

  const loadBase = async () => {
    setLoading(true);
    try {
      const [settingsData, customersResult] = await Promise.all([
        companyService.getLoyaltySettings(),
        companyService.list('customers', { page: 1, pageSize: 200, is_active: 'true' }),
      ]);
      setSettings({
        points_per_service: Number(settingsData?.points_per_service ?? 1),
        cashback_percent: Number(settingsData?.cashback_percent ?? 0),
        tenth_service_free: Boolean(settingsData?.tenth_service_free ?? true),
        point_value: Number(settingsData?.point_value ?? 1),
        is_active: Boolean(settingsData?.is_active ?? true),
      });
      const list = Array.isArray(customersResult?.data) ? customersResult.data : [];
      const normalized = list.map((item: any) => ({ id: item.id, name: item.name }));
      setCustomers(normalized);
      if (!selectedCustomerId && normalized.length > 0) {
        setSelectedCustomerId(normalized[0].id);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar fidelidade');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  const loadProfile = async (customerId: string) => {
    if (!customerId) return;
    setProfileLoading(true);
    try {
      const result = await companyService.getCustomerLoyaltyProfile(customerId);
      setProfile(result);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar perfil de fidelidade');
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCustomerId) loadProfile(selectedCustomerId);
  }, [selectedCustomerId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await companyService.updateLoyaltySettings(settings);
      toast.success('Configuracoes de fidelidade atualizadas');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao salvar configuracoes');
    } finally {
      setSaving(false);
    }
  };

  const latestTransactions = useMemo(
    () => (Array.isArray(profile?.transactions) ? profile!.transactions.slice(0, 10) : []),
    [profile]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Fidelidade" description="Configure pontos, cashback e regra do 10o atendimento gratis" />

      <Card>
        <CardHeader>
          <CardTitle>Configuracoes Globais</CardTitle>
          <CardDescription>Estas regras se aplicam a toda a empresa.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Pontos por servico</Label>
            <Input
              type="number"
              min={0}
              value={settings.points_per_service}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, points_per_service: Number(e.target.value || 0) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Cashback (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={settings.cashback_percent}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, cashback_percent: Number(e.target.value || 0) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Valor do ponto (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={settings.point_value}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, point_value: Number(e.target.value || 0) }))
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.tenth_service_free}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, tenth_service_free: checked }))
              }
            />
            <Label>10o servico gratis</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.is_active}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, is_active: checked }))}
            />
            <Label>Programa ativo</Label>
          </div>
          <div>
            <Button onClick={handleSave} disabled={loading || saving}>
              {saving ? 'Salvando...' : 'Salvar configuracoes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perfil do Cliente</CardTitle>
          <CardDescription>Acompanhe saldo e extrato de fidelidade por cliente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 md:max-w-md">
            <Label>Cliente</Label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          {profileLoading ? <p className="text-sm text-muted-foreground">Carregando perfil...</p> : null}
          {!profileLoading && profile?.profile ? (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Saldo de pontos</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">
                    {Number(profile.profile.points_balance || 0).toFixed(0)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Saldo cashback</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">
                    {toMoney(profile.profile.cashback_balance || 0)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total pontos ganhos</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">
                    {Number(profile.profile.total_points_earned || 0).toFixed(0)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Servicos acumulados</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">
                    {Number(profile.profile.total_services_count || 0)}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Ultimas transacoes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {latestTransactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma transacao.</p>
                  ) : (
                    latestTransactions.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded border p-2 text-sm">
                        <div>
                          <p className="font-medium">{item.transaction_type}</p>
                          <p className="text-muted-foreground">
                            {new Date(item.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p>Pontos: {Number(item.points_delta || 0).toFixed(0)}</p>
                          <p>Cashback: {toMoney(item.cashback_delta || 0)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default Fidelidade;
