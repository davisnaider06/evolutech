import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/crud/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { companyService } from '@/services/company';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

type Plan = {
  id: string;
  name: string;
  description?: string | null;
  interval: 'monthly' | 'quarterly' | 'yearly';
  price: number;
  included_services?: number | null;
  is_unlimited: boolean;
  is_active: boolean;
};

type CustomerSubscription = {
  id: string;
  customer_name: string | null;
  plan_name: string | null;
  status: string;
  start_at: string;
  end_at: string;
  remaining_services: number | null;
  amount: number;
  auto_renew: boolean;
};

type SubscriptionUsage = {
  id: string;
  subscription_id: string;
  customer_name: string | null;
  plan_name: string | null;
  order_id: string | null;
  service_name: string | null;
  quantity: number;
  amount_discounted: number;
  used_at: string;
};

const toMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const Assinaturas: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [usage, setUsage] = useState<SubscriptionUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageFilterCustomerId, setUsageFilterCustomerId] = useState('');
  const [usageFilterSubscriptionId, setUsageFilterSubscriptionId] = useState('');

  const [planForm, setPlanForm] = useState({
    id: '',
    name: '',
    description: '',
    interval: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    price: 0,
    included_services: 2,
    is_unlimited: false,
    is_active: true,
  });

  const [subscriptionForm, setSubscriptionForm] = useState({
    customer_id: '',
    plan_id: '',
    amount: 0,
    auto_renew: true,
    status: 'active' as 'active' | 'pending' | 'expired' | 'canceled' | 'suspended',
    start_at: new Date().toISOString().slice(0, 10),
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansData, subscriptionsData, customersResult] = await Promise.all([
        companyService.listSubscriptionPlans(),
        companyService.listCustomerSubscriptions(),
        companyService.list('customers', { page: 1, pageSize: 200, is_active: 'true' }),
      ]);

      setPlans(Array.isArray(plansData) ? plansData : []);
      setSubscriptions(Array.isArray(subscriptionsData) ? subscriptionsData : []);
      const list = Array.isArray(customersResult?.data) ? customersResult.data : [];
      setCustomers(list.map((item: any) => ({ id: item.id, name: item.name })));
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar assinaturas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadUsage = async () => {
    setUsageLoading(true);
    try {
      const result = await companyService.listSubscriptionUsage({
        customerId: usageFilterCustomerId || undefined,
        subscriptionId: usageFilterSubscriptionId || undefined,
        page: 1,
        pageSize: 50,
      });
      setUsage(Array.isArray(result?.data) ? result.data : []);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar uso de assinaturas');
      setUsage([]);
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    loadUsage();
  }, [usageFilterCustomerId, usageFilterSubscriptionId]);

  const resetPlanForm = () => {
    setPlanForm({
      id: '',
      name: '',
      description: '',
      interval: 'monthly',
      price: 0,
      included_services: 2,
      is_unlimited: false,
      is_active: true,
    });
  };

  const handleSavePlan = async () => {
    if (!planForm.name.trim()) {
      toast.error('Informe o nome do plano');
      return;
    }
    setSavingPlan(true);
    try {
      await companyService.upsertSubscriptionPlan({
        id: planForm.id || undefined,
        name: planForm.name.trim(),
        description: planForm.description || undefined,
        interval: planForm.interval,
        price: Number(planForm.price || 0),
        included_services: planForm.is_unlimited ? null : Number(planForm.included_services || 0),
        is_unlimited: planForm.is_unlimited,
        is_active: planForm.is_active,
      });
      toast.success(planForm.id ? 'Plano atualizado' : 'Plano criado');
      resetPlanForm();
      await loadData();
      await loadUsage();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao salvar plano');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleEditPlan = (plan: Plan) => {
    setPlanForm({
      id: plan.id,
      name: plan.name,
      description: plan.description || '',
      interval: plan.interval,
      price: Number(plan.price || 0),
      included_services: Number(plan.included_services || 0),
      is_unlimited: Boolean(plan.is_unlimited),
      is_active: Boolean(plan.is_active),
    });
  };

  const selectedPlanPrice = useMemo(() => {
    const selected = plans.find((item) => item.id === subscriptionForm.plan_id);
    return Number(selected?.price || 0);
  }, [plans, subscriptionForm.plan_id]);

  useEffect(() => {
    if (!subscriptionForm.plan_id) return;
    setSubscriptionForm((prev) => ({ ...prev, amount: selectedPlanPrice }));
  }, [selectedPlanPrice, subscriptionForm.plan_id]);

  const handleSaveSubscription = async () => {
    if (!subscriptionForm.customer_id || !subscriptionForm.plan_id) {
      toast.error('Selecione cliente e plano');
      return;
    }
    setSavingSubscription(true);
    try {
      await companyService.upsertCustomerSubscription({
        customer_id: subscriptionForm.customer_id,
        plan_id: subscriptionForm.plan_id,
        amount: Number(subscriptionForm.amount || 0),
        auto_renew: subscriptionForm.auto_renew,
        status: subscriptionForm.status,
        start_at: subscriptionForm.start_at,
      });
      toast.success('Assinatura vinculada');
      setSubscriptionForm((prev) => ({
        ...prev,
        customer_id: '',
        plan_id: '',
        amount: 0,
        status: 'active',
      }));
      await loadData();
      await loadUsage();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao salvar assinatura');
    } finally {
      setSavingSubscription(false);
    }
  };

  const handleExportUsageExcel = () => {
    if (usage.length === 0) {
      toast.error('Nao ha dados para exportar');
      return;
    }

    const rows = usage.map((item) => ({
      cliente: item.customer_name || 'Cliente',
      plano: item.plan_name || 'Plano',
      assinatura_id: item.subscription_id,
      pedido_id: item.order_id || '',
      servico: item.service_name || '',
      quantidade: Number(item.quantity || 0),
      desconto_aplicado: Number(item.amount_discounted || 0),
      usado_em: new Date(item.used_at).toLocaleString('pt-BR'),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consumo Assinaturas');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `historico-assinaturas-${stamp}.xlsx`);
    toast.success('Arquivo Excel exportado');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Assinaturas" description="Gerencie planos e assinaturas de clientes" />

      <Card>
        <CardHeader>
          <CardTitle>Plano</CardTitle>
          <CardDescription>Crie e atualize planos mensal/trimestral/anual.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={planForm.name} onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Intervalo</Label>
            <select
              value={planForm.interval}
              onChange={(e) => setPlanForm((p) => ({ ...p, interval: e.target.value as any }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="monthly">Mensal</option>
              <option value="quarterly">Trimestral</option>
              <option value="yearly">Anual</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Preco</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={planForm.price}
              onChange={(e) => setPlanForm((p) => ({ ...p, price: Number(e.target.value || 0) }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Servicos inclusos</Label>
            <Input
              type="number"
              min={0}
              disabled={planForm.is_unlimited}
              value={planForm.included_services}
              onChange={(e) =>
                setPlanForm((p) => ({ ...p, included_services: Number(e.target.value || 0) }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Descricao</Label>
            <Input
              value={planForm.description}
              onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={planForm.is_unlimited}
              onCheckedChange={(checked) => setPlanForm((p) => ({ ...p, is_unlimited: checked }))}
            />
            <Label>Ilimitado</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={planForm.is_active}
              onCheckedChange={(checked) => setPlanForm((p) => ({ ...p, is_active: checked }))}
            />
            <Label>Ativo</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSavePlan} disabled={savingPlan}>
              {savingPlan ? 'Salvando...' : planForm.id ? 'Atualizar plano' : 'Criar plano'}
            </Button>
            {planForm.id ? (
              <Button variant="outline" onClick={resetPlanForm}>
                Cancelar edicao
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vincular assinatura ao cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <Label>Cliente</Label>
            <select
              value={subscriptionForm.customer_id}
              onChange={(e) => setSubscriptionForm((p) => ({ ...p, customer_id: e.target.value }))}
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
          <div className="space-y-1">
            <Label>Plano</Label>
            <select
              value={subscriptionForm.plan_id}
              onChange={(e) => setSubscriptionForm((p) => ({ ...p, plan_id: e.target.value }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione</option>
              {plans.filter((plan) => plan.is_active).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Inicio</Label>
            <Input
              type="date"
              value={subscriptionForm.start_at}
              onChange={(e) => setSubscriptionForm((p) => ({ ...p, start_at: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Valor</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={subscriptionForm.amount}
              onChange={(e) => setSubscriptionForm((p) => ({ ...p, amount: Number(e.target.value || 0) }))}
            />
          </div>
          <div className="flex items-center gap-2 pt-7">
            <Switch
              checked={subscriptionForm.auto_renew}
              onCheckedChange={(checked) => setSubscriptionForm((p) => ({ ...p, auto_renew: checked }))}
            />
            <Label>Renovacao automatica</Label>
          </div>
          <Button onClick={handleSaveSubscription} disabled={savingSubscription}>
            {savingSubscription ? 'Salvando...' : 'Vincular assinatura'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planos cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum plano cadastrado.</p>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  <p className="font-medium">{plan.name}</p>
                  <p className="text-muted-foreground">
                    {plan.interval} - {toMoney(plan.price)} -{' '}
                    {plan.is_unlimited ? 'Ilimitado' : `${plan.included_services || 0} servicos`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleEditPlan(plan)}>
                  Editar
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assinaturas de clientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma assinatura cadastrada.</p>
          ) : (
            subscriptions.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  <p className="font-medium">{item.customer_name || 'Cliente'} - {item.plan_name || 'Plano'}</p>
                  <p className="text-muted-foreground">
                    {item.status} - Inicio {new Date(item.start_at).toLocaleDateString('pt-BR')} - Fim{' '}
                    {new Date(item.end_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <p>{toMoney(item.amount)}</p>
                  <p className="text-muted-foreground">
                    {item.remaining_services === null ? 'Ilimitado' : `Restantes: ${item.remaining_services}`}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historico de Consumo da Assinatura</CardTitle>
          <CardDescription>Uso por pedido e servico coberto no PDV.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Filtrar por cliente</Label>
              <select
                value={usageFilterCustomerId}
                onChange={(e) => setUsageFilterCustomerId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Filtrar por assinatura</Label>
              <select
                value={usageFilterSubscriptionId}
                onChange={(e) => setUsageFilterSubscriptionId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todas</option>
                {subscriptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {(item.customer_name || 'Cliente')} - {(item.plan_name || 'Plano')}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={loadUsage} disabled={usageLoading}>
                {usageLoading ? 'Atualizando...' : 'Atualizar historico'}
              </Button>
              <Button onClick={handleExportUsageExcel} disabled={usageLoading || usage.length === 0}>
                Exportar Excel
              </Button>
            </div>
          </div>

          {usageLoading ? (
            <p className="text-sm text-muted-foreground">Carregando historico...</p>
          ) : usage.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum consumo registrado.</p>
          ) : (
            <div className="space-y-2">
              {usage.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div>
                    <p className="font-medium">
                      {item.customer_name || 'Cliente'} - {item.plan_name || 'Plano'}
                    </p>
                    <p className="text-muted-foreground">
                      {item.service_name || 'Servico'} x{item.quantity} • Pedido:{' '}
                      {item.order_id ? item.order_id.slice(0, 8) : '-'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p>{toMoney(item.amount_discounted)}</p>
                    <p className="text-muted-foreground">
                      {new Date(item.used_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Assinaturas;
