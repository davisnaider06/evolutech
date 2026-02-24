import React, { useEffect, useState } from 'react';
import { companyService } from '@/services/company';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, QrCode, ReceiptText } from 'lucide-react';

type ChargeItem = {
  id: string;
  order_id: string;
  title: string;
  customer_name: string;
  amount: number;
  status: string;
  created_at: string;
  transaction?: {
    provider?: string;
    status?: string;
    qrCodeText?: string | null;
    qrCodeImageUrl?: string | null;
  } | null;
};

const Cobrancas: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [charges, setCharges] = useState<ChargeItem[]>([]);
  const [form, setForm] = useState({
    title: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    amount: '',
    description: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const payload = await companyService.listBillingCharges({ page: 1, pageSize: 30 });
      setCharges(Array.isArray(payload?.data) ? payload.data : []);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar cobranças');
      setCharges([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    const amount = Number(form.amount);
    if (!form.title.trim() || !form.customer_name.trim() || amount <= 0) {
      toast.error('Preencha titulo, cliente e valor');
      return;
    }

    setSaving(true);
    try {
      const created = await companyService.createBillingCharge({
        title: form.title.trim(),
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim() || undefined,
        customer_phone: form.customer_phone.trim() || undefined,
        amount,
        description: form.description.trim() || undefined,
        payment_method: 'pix',
      });

      toast.success('Cobrança criada com sucesso');
      setForm({
        title: '',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        amount: '',
        description: '',
      });

      await load();

      const qr = created?.payment_gateway?.qrCodeText;
      if (qr) {
        navigator.clipboard.writeText(qr).catch(() => null);
        toast.info('PIX copia e cola copiado para área de transferência');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao criar cobrança');
    } finally {
      setSaving(false);
    }
  };

  const copyPix = async (value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Código PIX copiado');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">Cobranças</h1>
        <p className="text-muted-foreground">
          Gere cobranças com PIX no gateway ativo da empresa.
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5" />
            Nova cobrança
          </CardTitle>
          <CardDescription>
            Ao criar, o sistema gera a cobrança no gateway e salva no Financeiro/Relatórios.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((old) => ({ ...old, title: e.target.value }))}
              placeholder="Ex: Consulta de retorno"
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
              placeholder="(00) 00000-0000"
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
            <Label>Descrição (opcional)</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((old) => ({ ...old, description: e.target.value }))}
              placeholder="Detalhes da cobrança"
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={submit} disabled={saving} className="w-full sm:w-auto">
              {saving ? 'Gerando cobrança...' : 'Gerar cobrança PIX'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Cobranças geradas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-muted-foreground">Carregando...</p>}
          {!loading && charges.length === 0 && (
            <p className="text-muted-foreground">Nenhuma cobrança criada.</p>
          )}
          {!loading &&
            charges.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border p-4 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.customer_name} • Pedido {item.order_id.slice(0, 8)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.status === 'paid' ? 'default' : 'secondary'}>
                      {item.status}
                    </Badge>
                    <span className="font-semibold">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(Number(item.amount || 0))}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {item.transaction?.provider || 'gateway'}
                  </Badge>
                  <Badge variant="outline">
                    {item.transaction?.status || 'pending'}
                  </Badge>
                  {item.transaction?.qrCodeText && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => copyPix(item.transaction?.qrCodeText)}
                    >
                      <Copy className="h-4 w-4" />
                      Copiar PIX
                    </Button>
                  )}
                </div>

                {item.transaction?.qrCodeImageUrl && (
                  <div className="rounded-md border border-border p-3 inline-block">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <QrCode className="h-3 w-3" />
                      QR Code da cobrança
                    </p>
                    <img
                      src={item.transaction.qrCodeImageUrl}
                      alt="QR Code cobrança"
                      className="h-44 w-44 object-contain"
                    />
                  </div>
                )}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Cobrancas;

