import React, { useEffect, useMemo, useState } from 'react';
import { companyService } from '@/services/company';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Copy, Download, ExternalLink, QrCode, ReceiptText, RefreshCcw } from 'lucide-react';

type ChargeItem = {
  id: string;
  order_id: string;
  title: string;
  customer_name: string;
  customer_phone?: string | null;
  amount: number;
  status: string;
  due_date?: string | null;
  created_at: string;
  transaction?: {
    provider?: string;
    status?: string;
    qrCodeText?: string | null;
    qrCodeImageUrl?: string | null;
    paymentLinkUrl?: string | null;
  } | null;
};

type MetricsResponse = {
  summary?: {
    paid_amount?: number;
    paid_count?: number;
    overdue_amount?: number;
    overdue_total_count?: number;
    pending_amount?: number;
    pending_count?: number;
    overdue_count?: number;
    upcoming_count?: number;
  };
};

type ReminderItem = {
  id: string;
  billing_charge_id: string;
  step_code: string;
  channel: string;
  scheduled_at: string;
  sent_at?: string | null;
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'canceled' | string;
  error_message?: string | null;
  attempt_count?: number;
  last_attempt_at?: string | null;
  next_retry_at?: string | null;
  billing_charge?: {
    id: string;
    title: string;
    customer_name: string;
    customer_phone?: string | null;
    amount: number;
    due_date?: string | null;
    status?: string;
  } | null;
};

type ExecutionLogItem = {
  id: string;
  trigger_source: string;
  dry_run: boolean;
  send_now: boolean;
  charges_analyzed: number;
  reminders_created: number;
  reminders_sent: number;
  reminders_failed: number;
  reminders_retried: number;
  processed_scheduled: number;
  status: string;
  error_message?: string | null;
  created_at: string;
};

type AutomationResult = {
  dry_run: boolean;
  send_now: boolean;
  charges_analyzed: number;
  reminders_created: number;
  reminders_sent: number;
  reminders_failed: number;
  preview?: Array<{
    billing_charge_id: string;
    title: string;
    customer_name: string;
    customer_phone?: string | null;
    amount: number;
    due_date?: string | null;
    step_code: string;
    scheduled_at: string;
    has_phone: boolean;
    already_exists: boolean;
    action: 'schedule' | 'skip_existing';
  }>;
};

const currency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const datetime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
};

const dateOnly = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid' || normalized === 'sent') return 'default';
  if (normalized === 'failed' || normalized === 'overdue') return 'destructive';
  if (normalized === 'processing') return 'secondary';
  return 'outline';
};

const executionLabel = (value: string) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'manual') return 'Manual';
  if (normalized === 'manual-reprocess') return 'Reprocessamento manual';
  if (normalized === 'manual-process-due') return 'Processar agendados';
  if (normalized === 'job') return 'Job de agendamento';
  if (normalized === 'job-cycle') return 'Ciclo completo do job';
  return value || '-';
};

const Cobrancas: React.FC = () => {
  const [loadingCharges, setLoadingCharges] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [loadingExecutions, setLoadingExecutions] = useState(true);
  const [savingCharge, setSavingCharge] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [processingDue, setProcessingDue] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [charges, setCharges] = useState<ChargeItem[]>([]);
  const [metrics, setMetrics] = useState<MetricsResponse['summary'] | null>(null);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogItem[]>([]);
  const [exportingExecutions, setExportingExecutions] = useState(false);
  const [lastAutomationResult, setLastAutomationResult] = useState<AutomationResult | null>(null);
  const [form, setForm] = useState({
    title: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    amount: '',
    due_date: '',
    description: '',
    payment_method: 'pix' as 'pix' | 'credito' | 'debito',
  });
  const [reminderFilters, setReminderFilters] = useState({
    status: '',
    step_code: '',
    customer: '',
    date_from: '',
    date_to: '',
    billing_charge_id: '',
  });
  const [executionFilters, setExecutionFilters] = useState({
    trigger_source: '',
    status: '',
    date_from: '',
    date_to: '',
  });

  const activeFilterCount = useMemo(() => {
    return Object.values(reminderFilters).filter(Boolean).length;
  }, [reminderFilters]);
  const previewToShow = useMemo(
    () => (Array.isArray(lastAutomationResult?.preview) ? lastAutomationResult.preview : []),
    [lastAutomationResult]
  );

  const loadCharges = async () => {
    setLoadingCharges(true);
    try {
      const payload = await companyService.listCollectionsReceivables({ page: 1, pageSize: 30 });
      setCharges(Array.isArray(payload?.data) ? payload.data : []);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar recebiveis');
      setCharges([]);
    } finally {
      setLoadingCharges(false);
    }
  };

  const loadMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const payload = await companyService.getCollectionsMetrics();
      setMetrics(payload?.summary || null);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar metricas');
      setMetrics(null);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const loadReminders = async (
    nextFilters?: Partial<typeof reminderFilters>,
    options?: { silent?: boolean }
  ) => {
    setLoadingReminders(true);
    try {
      const mergedFilters = { ...reminderFilters, ...(nextFilters || {}) };
      const payload = await companyService.listCollectionReminders({
        status: mergedFilters.status || undefined,
        step_code: mergedFilters.step_code || undefined,
        customer: mergedFilters.customer || undefined,
        date_from: mergedFilters.date_from || undefined,
        date_to: mergedFilters.date_to || undefined,
        billing_charge_id: mergedFilters.billing_charge_id || undefined,
        page: 1,
        pageSize: 50,
      });
      setReminders(Array.isArray(payload?.data) ? payload.data : []);
      if (nextFilters && !options?.silent) {
        toast.success('Lista de lembretes atualizada');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar lembretes');
      setReminders([]);
    } finally {
      setLoadingReminders(false);
    }
  };

  const executionActiveFilterCount = useMemo(() => {
    return Object.values(executionFilters).filter(Boolean).length;
  }, [executionFilters]);

  const loadExecutionLogs = async (nextFilters?: Partial<typeof executionFilters>) => {
    setLoadingExecutions(true);
    try {
      const mergedFilters = { ...executionFilters, ...(nextFilters || {}) };
      const payload = await companyService.listCollectionsExecutionLogs({
        page: 1,
        pageSize: 10,
        trigger_source: mergedFilters.trigger_source || undefined,
        status: mergedFilters.status || undefined,
        date_from: mergedFilters.date_from || undefined,
        date_to: mergedFilters.date_to || undefined,
      });
      setExecutionLogs(Array.isArray(payload?.data) ? payload.data : []);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar execucoes');
      setExecutionLogs([]);
    } finally {
      setLoadingExecutions(false);
    }
  };

  const loadAll = async () => {
    await Promise.all([loadCharges(), loadMetrics(), loadReminders(), loadExecutionLogs()]);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const submit = async () => {
    const amount = Number(form.amount);
    if (!form.title.trim() || !form.customer_name.trim() || amount <= 0) {
      toast.error('Preencha titulo, cliente e valor');
      return;
    }

    setSavingCharge(true);
    try {
      const created = await companyService.createCollectionsReceivable({
        title: form.title.trim(),
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim() || undefined,
        customer_phone: form.customer_phone.trim() || undefined,
        amount,
        due_date: form.due_date || undefined,
        description: form.description.trim() || undefined,
        payment_method: form.payment_method,
      });

      toast.success('Cobranca criada com sucesso');
      setForm({
        title: '',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        amount: '',
        due_date: '',
        description: '',
        payment_method: 'pix',
      });

      await Promise.all([loadCharges(), loadMetrics()]);

      const qr = created?.payment_gateway?.qrCodeText;
      if (qr) {
        navigator.clipboard.writeText(qr).catch(() => null);
        toast.info('PIX copia e cola copiado para area de transferencia');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao criar cobranca');
    } finally {
      setSavingCharge(false);
    }
  };

  const copyPix = async (value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Codigo PIX copiado');
    } catch {
      toast.error('Nao foi possivel copiar');
    }
  };

  const markAsPaid = async (chargeId: string) => {
    try {
      await companyService.markCollectionsReceivablePaid(chargeId);
      toast.success('Cobranca marcada como paga');
      await Promise.all([loadCharges(), loadMetrics(), loadReminders()]);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao marcar cobranca como paga');
    }
  };

  const runAutomation = async (dryRun: boolean) => {
    setRunningAutomation(true);
    try {
      const payload = await companyService.runCollectionsAutomation({
        dry_run: dryRun,
        send_now: dryRun ? false : true,
      });
      setLastAutomationResult(payload);
      if (dryRun) {
        toast.success('Simulacao concluida');
      } else {
        toast.success('Automacao executada com envio');
      }
      await Promise.all([loadMetrics(), loadReminders(), loadCharges()]);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao rodar automacao');
    } finally {
      setRunningAutomation(false);
    }
  };

  const reprocessReminder = async (reminderId: string) => {
    setReprocessingId(reminderId);
    try {
      await companyService.reprocessCollectionReminder(reminderId, { send_now: true });
      toast.success('Lembrete reprocessado');
      await loadReminders();
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao reprocessar lembrete');
    } finally {
      setReprocessingId(null);
    }
  };

  const processDueReminders = async () => {
    setProcessingDue(true);
    try {
      const payload = await companyService.processDueCollectionReminders({ limit: 50 });
      toast.success(
        `Processados ${Number(payload?.processed_count || 0)} lembretes. Enviados: ${Number(
          payload?.reminders_sent || 0
        )}, falhos: ${Number(payload?.reminders_failed || 0)}`
      );
      await Promise.all([loadReminders(), loadExecutionLogs(), loadMetrics(), loadCharges()]);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao processar lembretes agendados');
    } finally {
      setProcessingDue(false);
    }
  };

  const exportExecutionLogs = async () => {
    setExportingExecutions(true);
    try {
      const blob = await companyService.exportCollectionsExecutionLogsExcel({
        trigger_source: executionFilters.trigger_source || undefined,
        status: executionFilters.status || undefined,
        date_from: executionFilters.date_from || undefined,
        date_to: executionFilters.date_to || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `collections-execucoes-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Exportacao concluida');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao exportar execucoes');
    } finally {
      setExportingExecutions(false);
    }
  };

  const applyHistoryFilter = async (chargeId: string) => {
    const nextFilters = { ...reminderFilters, billing_charge_id: chargeId };
    setReminderFilters(nextFilters);
    try {
      await loadReminders(nextFilters, { silent: true });
      toast.success('Historico filtrado pela cobranca selecionada');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao filtrar historico');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">Collections e Cobrancas</h1>
        <p className="text-muted-foreground">
          Operacao de cobranca com recebiveis, automacao de lembretes e acompanhamento de inadimplencia.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMetrics ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                <p className="text-xl font-semibold">{currency(Number(metrics?.pending_amount || 0))}</p>
                <p className="text-xs text-muted-foreground">{Number(metrics?.pending_count || 0)} cobrancas</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pago</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMetrics ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                <p className="text-xl font-semibold">{currency(Number(metrics?.paid_amount || 0))}</p>
                <p className="text-xs text-muted-foreground">{Number(metrics?.paid_count || 0)} cobrancas</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMetrics ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                <p className="text-xl font-semibold">{currency(Number(metrics?.overdue_amount || 0))}</p>
                <p className="text-xs text-muted-foreground">{Number(metrics?.overdue_total_count || 0)} cobrancas</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">A vencer</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMetrics ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                <p className="text-xl font-semibold">{Number(metrics?.upcoming_count || 0)}</p>
                <p className="text-xs text-muted-foreground">cobrancas pendentes futuras</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5" />
            Automacao da regua
          </CardTitle>
          <CardDescription>
            Executa as etapas d0, d3, d7 e d15 nas cobrancas pendentes/overdue. Use simulacao antes do envio real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={runningAutomation} onClick={() => runAutomation(true)}>
              {runningAutomation ? 'Executando...' : 'Rodar simulacao (dry run)'}
            </Button>
            <Button disabled={runningAutomation} onClick={() => runAutomation(false)}>
              {runningAutomation ? 'Executando...' : 'Rodar automacao com envio'}
            </Button>
            <Button variant="secondary" disabled={processingDue} onClick={processDueReminders}>
              {processingDue ? 'Processando...' : 'Processar agendados e retries'}
            </Button>
            <Button variant="ghost" disabled={runningAutomation} onClick={loadReminders}>
              Atualizar lembretes
            </Button>
            <Button variant="ghost" disabled={loadingExecutions} onClick={loadExecutionLogs}>
              Atualizar execucoes
            </Button>
          </div>

          {lastAutomationResult && (
            <div className="rounded-lg border border-border p-4 text-sm">
              <p className="font-medium mb-2">
                Ultima execucao {lastAutomationResult.dry_run ? '(simulacao)' : '(real)'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <span>Cobrancas analisadas: {lastAutomationResult.charges_analyzed}</span>
                <span>Lembretes gerados: {lastAutomationResult.reminders_created}</span>
                <span>Lembretes enviados: {lastAutomationResult.reminders_sent}</span>
                <span>Lembretes com falha: {lastAutomationResult.reminders_failed}</span>
              </div>
            </div>
          )}

          {lastAutomationResult?.dry_run && previewToShow.length > 0 && (
            <div className="rounded-lg border border-border p-4 text-sm">
              <p className="mb-3 font-medium">Preview da simulacao</p>
              <div className="space-y-2">
                {previewToShow.slice(0, 12).map((item) => (
                  <div key={`${item.billing_charge_id}-${item.step_code}`} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-muted-foreground">
                          {item.customer_name} - etapa {item.step_code} - agendado {datetime(item.scheduled_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.action === 'schedule' ? 'default' : 'outline'}>
                          {item.action === 'schedule' ? 'Vai gerar lembrete' : 'Ja existe'}
                        </Badge>
                        <Badge variant={item.has_phone ? 'outline' : 'destructive'}>
                          {item.has_phone ? 'Com telefone' : 'Sem telefone'}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      Valor {currency(item.amount)} - vencimento {dateOnly(item.due_date)}
                    </p>
                  </div>
                ))}
              </div>
              {previewToShow.length > 12 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Mostrando 12 de {previewToShow.length} itens previstos na simulacao.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5" />
            Nova cobranca
          </CardTitle>
          <CardDescription>
            Cobranca integrada ao gateway para PIX ou link de pagamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Titulo</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((old) => ({ ...old, title: e.target.value }))}
              placeholder="Ex: Mensalidade de servicos"
            />
          </div>
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input
              value={form.customer_name}
              onChange={(e) => setForm((old) => ({ ...old, customer_name: e.target.value }))}
              placeholder="Nome do cliente"
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail (opcional)</Label>
            <Input
              value={form.customer_email}
              onChange={(e) => setForm((old) => ({ ...old, customer_email: e.target.value }))}
              placeholder="cliente@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone (opcional)</Label>
            <Input
              value={form.customer_phone}
              onChange={(e) => setForm((old) => ({ ...old, customer_phone: e.target.value }))}
              placeholder="5511999999999"
            />
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((old) => ({ ...old, amount: e.target.value }))}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-2">
            <Label>Vencimento (opcional)</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((old) => ({ ...old, due_date: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select
              value={form.payment_method}
              onValueChange={(value: 'pix' | 'credito' | 'debito') =>
                setForm((old) => ({ ...old, payment_method: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX (QR Code)</SelectItem>
                <SelectItem value="credito">Credito (link)</SelectItem>
                <SelectItem value="debito">Debito (link)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descricao (opcional)</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((old) => ({ ...old, description: e.target.value }))}
              placeholder="Detalhes da cobranca"
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={submit} disabled={savingCharge} className="w-full sm:w-auto">
              {savingCharge ? 'Gerando cobranca...' : 'Gerar cobranca'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Logs de execucao</CardTitle>
          <CardDescription>
            Historico das simulacoes, envios manuais, processamento de agendados e execucoes automaticas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Origem</Label>
              <Select
                value={executionFilters.trigger_source || 'all'}
                onValueChange={(value) =>
                  setExecutionFilters((old) => ({ ...old, trigger_source: value === 'all' ? '' : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="manual-reprocess">Reprocessamento manual</SelectItem>
                  <SelectItem value="manual-process-due">Processar agendados</SelectItem>
                  <SelectItem value="job">Job</SelectItem>
                  <SelectItem value="job-cycle">Job cycle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={executionFilters.status || 'all'}
                onValueChange={(value) =>
                  setExecutionFilters((old) => ({ ...old, status: value === 'all' ? '' : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">completed</SelectItem>
                  <SelectItem value="partial">partial</SelectItem>
                  <SelectItem value="failed">failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data inicial</Label>
              <Input
                type="date"
                value={executionFilters.date_from}
                onChange={(e) => setExecutionFilters((old) => ({ ...old, date_from: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Data final</Label>
              <Input
                type="date"
                value={executionFilters.date_to}
                onChange={(e) => setExecutionFilters((old) => ({ ...old, date_to: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => loadExecutionLogs()} disabled={loadingExecutions}>
              Aplicar filtros
            </Button>
            <Button
              variant="ghost"
              disabled={loadingExecutions}
              onClick={() => {
                const emptyFilters = {
                  trigger_source: '',
                  status: '',
                  date_from: '',
                  date_to: '',
                };
                setExecutionFilters(emptyFilters);
                loadExecutionLogs(emptyFilters);
              }}
            >
              Limpar filtros
            </Button>
            <Button variant="secondary" disabled={exportingExecutions} onClick={exportExecutionLogs} className="gap-2">
              <Download className="h-4 w-4" />
              {exportingExecutions ? 'Exportando...' : 'Exportar Excel'}
            </Button>
            <Badge variant="outline">{executionActiveFilterCount} filtros ativos</Badge>
          </div>
          {loadingExecutions && <p className="text-muted-foreground">Carregando execucoes...</p>}
          {!loadingExecutions && executionLogs.length === 0 && (
            <p className="text-muted-foreground">Nenhuma execucao registrada ainda.</p>
          )}
          {!loadingExecutions &&
            executionLogs.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{executionLabel(item.trigger_source)}</p>
                    <p className="text-sm text-muted-foreground">
                      {datetime(item.created_at)} - {item.dry_run ? 'simulacao' : item.send_now ? 'envio ativo' : 'agendamento'}
                    </p>
                  </div>
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </div>

                <div className="grid gap-2 text-sm md:grid-cols-3 lg:grid-cols-6">
                  <p><span className="text-muted-foreground">Cobrancas:</span> {item.charges_analyzed}</p>
                  <p><span className="text-muted-foreground">Criados:</span> {item.reminders_created}</p>
                  <p><span className="text-muted-foreground">Enviados:</span> {item.reminders_sent}</p>
                  <p><span className="text-muted-foreground">Falhos:</span> {item.reminders_failed}</p>
                  <p><span className="text-muted-foreground">Retries:</span> {item.reminders_retried}</p>
                  <p><span className="text-muted-foreground">Processados:</span> {item.processed_scheduled}</p>
                </div>

                {item.error_message && (
                  <div className="rounded-md border border-border px-3 py-2 text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500" />
                    <span>{item.error_message}</span>
                  </div>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Recebiveis</CardTitle>
          <CardDescription>
            Clique em "Historico" para ver lembretes daquela cobranca na lista abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingCharges && <p className="text-muted-foreground">Carregando...</p>}
          {!loadingCharges && charges.length === 0 && (
            <p className="text-muted-foreground">Nenhuma cobranca criada.</p>
          )}
          {!loadingCharges &&
            charges.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.customer_name} - Pedido {item.order_id.slice(0, 8)} - Venc.: {dateOnly(item.due_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                    <span className="font-semibold">{currency(item.amount)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{item.transaction?.provider || 'gateway'}</Badge>
                  <Badge variant="outline">{item.transaction?.status || 'pending'}</Badge>
                  {item.transaction?.qrCodeText && (
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => copyPix(item.transaction?.qrCodeText)}>
                      <Copy className="h-4 w-4" />
                      Copiar PIX
                    </Button>
                  )}
                  {item.transaction?.paymentLinkUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => window.open(item.transaction?.paymentLinkUrl || '#', '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir link
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => applyHistoryFilter(item.id)}>
                    Historico
                  </Button>
                  {item.status !== 'paid' && (
                    <Button size="sm" onClick={() => markAsPaid(item.id)}>
                      Marcar como pago
                    </Button>
                  )}
                </div>

                {item.transaction?.qrCodeImageUrl && (
                  <div className="rounded-md border border-border p-3 inline-block">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <QrCode className="h-3 w-3" />
                      QR Code da cobranca
                    </p>
                    <img src={item.transaction.qrCodeImageUrl} alt="QR Code cobranca" className="h-44 w-44 object-contain" />
                  </div>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Lembretes de cobranca</CardTitle>
          <CardDescription>
            Filtros por status, etapa, periodo, cliente e cobranca. Falhas podem ser reprocessadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={reminderFilters.status || 'all'}
                onValueChange={(value) =>
                  setReminderFilters((old) => ({ ...old, status: value === 'all' ? '' : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="scheduled">scheduled</SelectItem>
                  <SelectItem value="processing">processing</SelectItem>
                  <SelectItem value="sent">sent</SelectItem>
                  <SelectItem value="failed">failed</SelectItem>
                  <SelectItem value="canceled">canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select
                value={reminderFilters.step_code || 'all'}
                onValueChange={(value) =>
                  setReminderFilters((old) => ({ ...old, step_code: value === 'all' ? '' : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="d0">d0</SelectItem>
                  <SelectItem value="d3">d3</SelectItem>
                  <SelectItem value="d7">d7</SelectItem>
                  <SelectItem value="d15">d15</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input
                value={reminderFilters.customer}
                onChange={(e) => setReminderFilters((old) => ({ ...old, customer: e.target.value }))}
                placeholder="Nome ou titulo"
              />
            </div>
            <div className="space-y-2">
              <Label>Data inicial</Label>
              <Input
                type="date"
                value={reminderFilters.date_from}
                onChange={(e) => setReminderFilters((old) => ({ ...old, date_from: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Data final</Label>
              <Input
                type="date"
                value={reminderFilters.date_to}
                onChange={(e) => setReminderFilters((old) => ({ ...old, date_to: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Cobranca ID</Label>
              <Input
                value={reminderFilters.billing_charge_id}
                onChange={(e) =>
                  setReminderFilters((old) => ({ ...old, billing_charge_id: e.target.value }))
                }
                placeholder="UUID da cobranca"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={loadReminders} disabled={loadingReminders}>
              Aplicar filtros
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                const emptyFilters = {
                  status: '',
                  step_code: '',
                  customer: '',
                  date_from: '',
                  date_to: '',
                  billing_charge_id: '',
                };
                setReminderFilters(emptyFilters);
                loadReminders(emptyFilters, { silent: true });
              }}
              disabled={loadingReminders}
            >
              Limpar filtros
            </Button>
            <Badge variant="outline">{activeFilterCount} filtros ativos</Badge>
          </div>

          {loadingReminders && <p className="text-muted-foreground">Carregando lembretes...</p>}
          {!loadingReminders && reminders.length === 0 && (
            <p className="text-muted-foreground">Nenhum lembrete encontrado para os filtros atuais.</p>
          )}
          {!loadingReminders &&
            reminders.map((item) => (
              <div key={item.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.billing_charge?.title || 'Cobranca sem titulo'}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.billing_charge?.customer_name || '-'} - Etapa {item.step_code} - Agendado {datetime(item.scheduled_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                    <Badge variant="outline">{item.channel}</Badge>
                  </div>
                </div>

                <div className="grid gap-2 text-sm md:grid-cols-3">
                  <p>
                    <span className="text-muted-foreground">Cobranca:</span> {item.billing_charge_id.slice(0, 8)}...
                  </p>
                  <p>
                    <span className="text-muted-foreground">Valor:</span> {currency(Number(item.billing_charge?.amount || 0))}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Enviado em:</span> {datetime(item.sent_at)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Tentativas:</span> {Number(item.attempt_count || 0)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Ultima tentativa:</span> {datetime(item.last_attempt_at)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Proximo retry:</span> {datetime(item.next_retry_at)}
                  </p>
                </div>

                {item.error_message && (
                  <div className="rounded-md border border-border px-3 py-2 text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500" />
                    <span>{item.error_message}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {item.status === 'failed' && (
                    <Button
                      size="sm"
                      onClick={() => reprocessReminder(item.id)}
                      disabled={reprocessingId === item.id}
                      className="gap-2"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      {reprocessingId === item.id ? 'Reprocessando...' : 'Reprocessar'}
                    </Button>
                  )}
                  {item.status === 'sent' && (
                    <span className="inline-flex items-center text-sm text-emerald-500 gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Envio confirmado
                    </span>
                  )}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Cobrancas;
