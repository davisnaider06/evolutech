import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { companyService } from '@/services/company';
import { PageHeader } from '@/components/crud/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

type CommissionProfile = {
  professional_id: string;
  professional_name: string;
  professional_email?: string;
  role: string;
  service_commission_pct: number;
  product_commission_pct: number;
  monthly_fixed_amount: number;
  commission_profile_active: boolean;
};

type CommissionOverviewItem = {
  professional_id: string;
  professional_name: string;
  service_revenue: number;
  product_revenue: number;
  service_commission_pct: number;
  product_commission_pct: number;
  monthly_fixed_amount: number;
  monthly_adjustments: number;
  service_commission_amount: number;
  product_commission_amount: number;
  total_commission: number;
  payout_status?: string;
  amount_paid?: number;
  amount_pending?: number;
  paid_at?: string | null;
};

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const toMoney = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Comissoes: React.FC = () => {
  const { user } = useAuth();
  const isOwner = user?.role === 'DONO_EMPRESA';
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<CommissionProfile[]>([]);
  const [rows, setRows] = useState<CommissionOverviewItem[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');

  const [servicePct, setServicePct] = useState('40');
  const [productPct, setProductPct] = useState('10');
  const [monthlyFixed, setMonthlyFixed] = useState('0');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [payingProfessionalId, setPayingProfessionalId] = useState('');

  const selectedProfile = useMemo(
    () => profiles.find((item) => item.professional_id === selectedProfessionalId) || null,
    [profiles, selectedProfessionalId]
  );

  const syncProfileForm = useCallback((profile: CommissionProfile | null) => {
    setServicePct(String(profile?.service_commission_pct ?? 40));
    setProductPct(String(profile?.product_commission_pct ?? 10));
    setMonthlyFixed(String(profile?.monthly_fixed_amount ?? 0));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesData, overview] = await Promise.all([
        companyService.listCommissionProfiles(),
        companyService.commissionsOverview({ month }),
      ]);
      const normalizedProfiles = Array.isArray(profilesData) ? profilesData : [];
      setProfiles(normalizedProfiles);
      setRows(Array.isArray(overview?.data) ? overview.data : []);

      if (isOwner && !selectedProfessionalId && normalizedProfiles.length > 0) {
        setSelectedProfessionalId(normalizedProfiles[0].professional_id);
      }
      if (!isOwner && normalizedProfiles.length > 0) {
        setSelectedProfessionalId(normalizedProfiles[0].professional_id);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar comissoes');
    } finally {
      setLoading(false);
    }
  }, [isOwner, month, selectedProfessionalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    syncProfileForm(selectedProfile);
  }, [selectedProfile, syncProfileForm]);

  const handleSaveProfile = async () => {
    if (!selectedProfessionalId) {
      toast.error('Selecione um profissional');
      return;
    }
    setSavingProfile(true);
    try {
      await companyService.upsertCommissionProfile(selectedProfessionalId, {
        service_commission_pct: Number(servicePct || 0),
        product_commission_pct: Number(productPct || 0),
        monthly_fixed_amount: Number(monthlyFixed || 0),
      });
      toast.success('Regra de comissao salva');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao salvar regra');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAdjustment = async () => {
    if (!selectedProfessionalId) {
      toast.error('Selecione um profissional');
      return;
    }
    if (!adjustmentAmount || Number(adjustmentAmount) === 0) {
      toast.error('Informe um ajuste diferente de zero');
      return;
    }

    setSavingAdjustment(true);
    try {
      await companyService.createCommissionAdjustment({
        professional_id: selectedProfessionalId,
        month,
        amount: Number(adjustmentAmount),
        reason: adjustmentReason || undefined,
      });
      setAdjustmentAmount('');
      setAdjustmentReason('');
      toast.success('Ajuste mensal registrado');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao registrar ajuste');
    } finally {
      setSavingAdjustment(false);
    }
  };

  const handleExport = async () => {
    try {
      const csv = await companyService.exportCommissionsCsv(month);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comissoes-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Relatorio exportado');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao exportar relatorio');
    }
  };

  const handleMarkPayout = async (row: CommissionOverviewItem, status: 'pending' | 'paid') => {
    if (!isOwner) return;
    setPayingProfessionalId(row.professional_id);
    try {
      await companyService.upsertCommissionPayout({
        professional_id: row.professional_id,
        month,
        status,
        amount_paid: status === 'paid' ? Number(row.total_commission || 0) : 0,
      });
      toast.success(status === 'paid' ? 'Pagamento marcado como pago' : 'Pagamento marcado como pendente');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao atualizar pagamento');
    } finally {
      setPayingProfessionalId('');
    }
  };

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.service += Number(row.service_revenue || 0);
        acc.product += Number(row.product_revenue || 0);
        acc.total += Number(row.total_commission || 0);
        return acc;
      },
      { service: 0, product: 0, total: 0 }
    );
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="Comissoes" description="Controle mensal por barbeiro/profissional" />

      <Card>
        <CardHeader>
          <CardTitle>Periodo e exportacao</CardTitle>
          <CardDescription>Fechamento mensal de comissoes por profissional.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Mes</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Receita servicos</Label>
            <Input readOnly value={toMoney(summary.service)} />
          </div>
          <div className="space-y-1">
            <Label>Total comissoes</Label>
            <Input readOnly value={toMoney(summary.total)} />
          </div>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar'}
          </Button>
          {isOwner ? <Button onClick={handleExport}>Exportar CSV</Button> : null}
        </CardContent>
      </Card>

      {isOwner ? (
      <Card>
        <CardHeader>
          <CardTitle>Regra por profissional</CardTitle>
          <CardDescription>Comissao por servico, produto e valor fixo mensal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1 md:col-span-2">
            <Label>Profissional</Label>
            <select
              value={selectedProfessionalId}
              onChange={(e) => setSelectedProfessionalId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione</option>
              {profiles.map((item) => (
                <option key={item.professional_id} value={item.professional_id}>
                  {item.professional_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>% servico</Label>
            <Input type="number" min={0} max={100} step="0.01" value={servicePct} onChange={(e) => setServicePct(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>% produto</Label>
            <Input type="number" min={0} max={100} step="0.01" value={productPct} onChange={(e) => setProductPct(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Fixo mensal</Label>
            <Input type="number" min={0} step="0.01" value={monthlyFixed} onChange={(e) => setMonthlyFixed(e.target.value)} />
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile || !selectedProfessionalId}>
            {savingProfile ? 'Salvando...' : 'Salvar regra'}
          </Button>
        </CardContent>
      </Card>
      ) : null}

      {isOwner ? (
      <Card>
        <CardHeader>
          <CardTitle>Ajuste mensal</CardTitle>
          <CardDescription>Bonus ou desconto manual no fechamento do mes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Valor (+/-)</Label>
            <Input
              type="number"
              step="0.01"
              value={adjustmentAmount}
              onChange={(e) => setAdjustmentAmount(e.target.value)}
              placeholder="Ex: 50 ou -30"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Motivo</Label>
            <Input value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} placeholder="Opcional" />
          </div>
          <Button onClick={handleAddAdjustment} disabled={savingAdjustment || !selectedProfessionalId}>
            {savingAdjustment ? 'Aplicando...' : 'Aplicar ajuste'}
          </Button>
        </CardContent>
      </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Relatorio por profissional</CardTitle>
          <CardDescription>Apuracao mensal consolidada.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Profissional</th>
                  <th className="p-2">Servicos</th>
                  <th className="p-2">Produtos</th>
                  <th className="p-2">Com. Servicos</th>
                  <th className="p-2">Com. Produtos</th>
                  <th className="p-2">Fixo/Ajustes</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Pagamento</th>
                  <th className="p-2">Pago em</th>
                  {isOwner ? <th className="p-2">Acoes</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.professional_id} className="border-b">
                    <td className="p-2">{row.professional_name}</td>
                    <td className="p-2">{toMoney(row.service_revenue)}</td>
                    <td className="p-2">{toMoney(row.product_revenue)}</td>
                    <td className="p-2">{toMoney(row.service_commission_amount)}</td>
                    <td className="p-2">{toMoney(row.product_commission_amount)}</td>
                    <td className="p-2">
                      {toMoney(Number(row.monthly_fixed_amount || 0) + Number(row.monthly_adjustments || 0))}
                    </td>
                    <td className="p-2 font-semibold">{toMoney(row.total_commission)}</td>
                    <td className="p-2">
                      {String(row.payout_status || 'pending') === 'paid'
                        ? `Pago (${toMoney(Number(row.amount_paid || 0))})`
                        : `Pendente (${toMoney(Number(row.amount_pending || row.total_commission || 0))})`}
                    </td>
                    <td className="p-2">
                      {row.paid_at ? new Date(row.paid_at).toLocaleString('pt-BR') : '-'}
                    </td>
                    {isOwner ? (
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleMarkPayout(row, 'paid')}
                            disabled={payingProfessionalId === row.professional_id}
                          >
                            Marcar pago
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkPayout(row, 'pending')}
                            disabled={payingProfessionalId === row.professional_id}
                          >
                            Voltar pendente
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={isOwner ? 10 : 9}>
                      Nenhum dado de comissao para o periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Comissoes;
