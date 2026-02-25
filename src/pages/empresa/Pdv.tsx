import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { companyService } from '@/services/company';

interface CatalogItem {
  id: string;
  type: 'product' | 'service';
  name: string;
  sku: string | null;
  price: number | string;
  stockQuantity: number | null;
  durationMinutes: number | null;
}

interface CartItem {
  itemType: 'product' | 'service';
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  stockQuantity: number | null;
}

interface PdvOrder {
  id: string;
  customerName: string | null;
  total: number;
  status: string;
  createdAt: string;
}

interface LoyaltyPreview {
  customer_found: boolean;
  loyalty_active: boolean;
  customer?: { id: string; name: string };
  profile?: {
    points_balance: number;
    cashback_balance: number;
    total_services_count: number;
  };
  automatic_discount: number;
  cashback_discount: number;
  tenth_service_discount: number;
  cashback_to_earn: number;
  points_to_earn: number;
  estimated_total: number;
}

interface PdvCheckoutPreview {
  customer_found: boolean;
  subscription: {
    enabled: boolean;
    subscription_id: string | null;
    plan_name: string | null;
    is_unlimited: boolean;
    covered_services: number;
    discount: number;
    remaining_services: number | null;
  };
  loyalty: LoyaltyPreview & {
    enabled?: boolean;
  };
  discounts: {
    manual_discount: number;
    subscription_discount: number;
    loyalty_discount: number;
    total_discount: number;
  };
  estimated_total: number;
}

const Pdv: React.FC = () => {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'pix' | 'credito' | 'debito'>('dinheiro');
  const [gatewayQrImage, setGatewayQrImage] = useState<string | null>(null);
  const [gatewayQrText, setGatewayQrText] = useState<string>('');
  const [gatewayPaymentUrl, setGatewayPaymentUrl] = useState<string>('');
  const [pendingPixOrders, setPendingPixOrders] = useState<PdvOrder[]>([]);
  const [pendingPixLoading, setPendingPixLoading] = useState(false);
  const [applyLoyalty, setApplyLoyalty] = useState(true);
  const [checkoutPreview, setCheckoutPreview] = useState<PdvCheckoutPreview | null>(null);
  const [loyaltyPreviewLoading, setLoyaltyPreviewLoading] = useState(false);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const data = await companyService.listPdvProducts(search);
      setCatalog(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar catalogo do PDV');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingPixOrders = async () => {
    try {
      setPendingPixLoading(true);
      const data = await companyService.listPdvOrders({ status: 'pending_pix', page: 1, pageSize: 20 });
      setPendingPixOrders(data?.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar pendencias PIX');
    } finally {
      setPendingPixLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchCatalog();
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    fetchPendingPixOrders();
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );

  const serviceQuantity = useMemo(
    () =>
      cart
        .filter((item) => item.itemType === 'service')
        .reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  useEffect(() => {
    const canPreview = customerName.trim().length > 0 && cart.length > 0;
    if (!canPreview) {
      setCheckoutPreview(null);
      setLoyaltyPreviewLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setLoyaltyPreviewLoading(true);
        const result = await companyService.previewPdvCheckout({
          customer_name: customerName.trim(),
          subtotal,
          service_quantity: serviceQuantity,
          manual_discount: discount,
          apply_loyalty: applyLoyalty,
        });
        setCheckoutPreview(result || null);
      } catch (_error) {
        setCheckoutPreview(null);
      } finally {
        setLoyaltyPreviewLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [applyLoyalty, customerName, cart.length, subtotal, serviceQuantity, discount]);

  const loyaltyAutomaticDiscount = Number(checkoutPreview?.discounts?.loyalty_discount || 0);
  const subscriptionDiscount = Number(checkoutPreview?.discounts?.subscription_discount || 0);
  const total = useMemo(
    () =>
      Number(checkoutPreview?.estimated_total ?? Math.max(0, subtotal - discount - loyaltyAutomaticDiscount)),
    [checkoutPreview?.estimated_total, subtotal, discount, loyaltyAutomaticDiscount]
  );
  const isPixFlow = paymentMethod === 'pix';
  const isCardMachineFlow = paymentMethod === 'credito' || paymentMethod === 'debito';

  const addToCart = (item: CatalogItem) => {
    const unitPrice = Number(item.price || 0);
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.itemType === item.type && cartItem.itemId === item.id);
      if (existing) {
        if (item.type === 'product' && typeof item.stockQuantity === 'number' && existing.quantity + 1 > item.stockQuantity) {
          toast.error('Estoque insuficiente');
          return prev;
        }

        return prev.map((cartItem) =>
          cartItem.itemType === item.type && cartItem.itemId === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }

      return [
        ...prev,
        {
          itemType: item.type,
          itemId: item.id,
          name: item.name,
          unitPrice,
          quantity: 1,
          stockQuantity: item.stockQuantity,
        },
      ];
    });
  };

  const setItemQty = (itemType: 'product' | 'service', itemId: string, quantity: number) => {
    setCart((prev) =>
      prev
        .map((cartItem) => {
          if (cartItem.itemType !== itemType || cartItem.itemId !== itemId) return cartItem;
          const maxQuantity =
            typeof cartItem.stockQuantity === 'number' ? cartItem.stockQuantity : Number.MAX_SAFE_INTEGER;
          return { ...cartItem, quantity: Math.max(0, Math.min(quantity, maxQuantity)) };
        })
        .filter((cartItem) => cartItem.quantity > 0)
    );
  };

  const resetGatewayView = () => {
    setGatewayQrText('');
    setGatewayQrImage(null);
    setGatewayPaymentUrl('');
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Carrinho vazio');
      return;
    }

    setCheckoutLoading(true);
    try {
      const result = await companyService.checkoutPdv({
        customerName: customerName.trim() || undefined,
        paymentMethod,
        discount,
        applyLoyalty,
        items: cart.map((item) => ({
          itemType: item.itemType,
          itemId: item.itemId,
          quantity: item.quantity,
        })),
      });

      const gateway = result?.payment_gateway || null;

      if (isPixFlow) {
        setGatewayQrText(gateway?.qrCodeText || '');
        setGatewayQrImage(gateway?.qrCodeImageUrl || null);
        setGatewayPaymentUrl(gateway?.paymentUrl || '');
        toast.success('PIX criado. A confirmacao ocorre automaticamente via gateway.');
      } else {
        resetGatewayView();
        const loyalty = result?.summary?.loyalty;
        if (loyalty?.enabled) {
          toast.success(
            `Venda finalizada. Desconto fidelidade: R$ ${Number(loyalty.automaticDiscount || 0).toFixed(2)}.`
          );
        } else {
          toast.success('Venda finalizada com sucesso');
        }
      }

      setCart([]);
      setCustomerName('');
      setDiscount(0);
      setCheckoutPreview(null);
      await Promise.all([fetchCatalog(), fetchPendingPixOrders()]);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao finalizar venda');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">PDV</h1>
        <p className="text-muted-foreground">Checkout com produtos e servicos da empresa</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Produtos e servicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Buscar por nome, SKU ou descricao..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {loading ? (
              <div className="py-10 text-center text-muted-foreground">Carregando catalogo...</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {catalog.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    onClick={() => addToCart(item)}
                    className="rounded-lg border p-3 text-left transition hover:border-primary"
                  >
                    <p className="font-medium">
                      {item.name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {item.type === 'service' ? 'Servico' : 'Produto'}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.type === 'service'
                        ? `${Number(item.durationMinutes || 0)} min`
                        : item.sku || 'Sem SKU'}
                    </p>
                    <p className="text-sm">
                      {item.type === 'service'
                        ? 'Sem controle de estoque'
                        : `Estoque: ${Number(item.stockQuantity || 0)}`}
                    </p>
                    <p className="font-semibold">R$ {Number(item.price || 0).toFixed(2)}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carrinho</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={`${item.itemType}-${item.itemId}`} className="rounded border p-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={typeof item.stockQuantity === 'number' ? item.stockQuantity : undefined}
                      value={item.quantity}
                      onChange={(event) => setItemQty(item.itemType, item.itemId, Number(event.target.value))}
                    />
                    <p className="whitespace-nowrap text-sm font-medium">
                      R$ {(item.unitPrice * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Cliente (opcional)</Label>
              <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Aplicar fidelidade</p>
                <p className="text-xs text-muted-foreground">Cashback e 10o servico gratis</p>
              </div>
              <Switch checked={applyLoyalty} onCheckedChange={setApplyLoyalty} />
            </div>

            {applyLoyalty ? (
              <div className="rounded-lg border p-3 space-y-1">
                {loyaltyPreviewLoading ? (
                  <p className="text-xs text-muted-foreground">Calculando fidelidade...</p>
                ) : !checkoutPreview ? (
                  <p className="text-xs text-muted-foreground">Informe cliente e itens para calcular beneficios.</p>
                ) : !checkoutPreview.customer_found ? (
                  <p className="text-xs text-muted-foreground">Cliente nao encontrado para fidelidade.</p>
                ) : !checkoutPreview.loyalty.loyalty_active ? (
                  <p className="text-xs text-muted-foreground">Fidelidade desativada nesta empresa.</p>
                ) : (
                  <>
                    <p className="text-xs">Cliente: <span className="font-medium">{checkoutPreview.loyalty.customer?.name}</span></p>
                    <p className="text-xs">Saldo cashback: R$ {Number(checkoutPreview.loyalty.profile?.cashback_balance || 0).toFixed(2)}</p>
                    <p className="text-xs">Saldo pontos: {Number(checkoutPreview.loyalty.profile?.points_balance || 0).toFixed(0)}</p>
                    <p className="text-xs">Desconto fidelidade: R$ {Number(checkoutPreview.loyalty.automatic_discount || 0).toFixed(2)}</p>
                    <p className="text-xs">Cashback a ganhar: R$ {Number(checkoutPreview.loyalty.cashback_to_earn || 0).toFixed(2)}</p>
                    <p className="text-xs">Pontos a ganhar: {Number(checkoutPreview.loyalty.points_to_earn || 0).toFixed(0)}</p>
                  </>
                )}
              </div>
            ) : null}

            {checkoutPreview?.subscription ? (
              <div className="rounded-lg border p-3 space-y-1">
                {!checkoutPreview.subscription.enabled ? (
                  <p className="text-xs text-muted-foreground">Sem cobertura de assinatura aplicavel nesta venda.</p>
                ) : (
                  <>
                    <p className="text-xs">
                      Assinatura ativa: <span className="font-medium">{checkoutPreview.subscription.plan_name || '-'}</span>
                    </p>
                    <p className="text-xs">
                      Servicos cobertos: {Number(checkoutPreview.subscription.covered_services || 0)}
                    </p>
                    <p className="text-xs">
                      Desconto assinatura: R$ {Number(checkoutPreview.subscription.discount || 0).toFixed(2)}
                    </p>
                    <p className="text-xs">
                      Saldo de servicos: {checkoutPreview.subscription.remaining_services === null ? 'Ilimitado' : checkoutPreview.subscription.remaining_services}
                    </p>
                  </>
                )}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Desconto</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(Number(event.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Pagamento</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value: 'dinheiro' | 'pix' | 'credito' | 'debito') => setPaymentMethod(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credito">Credito (maquininha)</SelectItem>
                  <SelectItem value="debito">Debito (maquininha)</SelectItem>
                </SelectContent>
              </Select>
              {isCardMachineFlow ? (
                <p className="text-xs text-muted-foreground">
                  Passe o cartao na maquininha e clique em "Finalizar Venda" para registrar no sistema.
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-dashed p-3">
              <p className="text-sm font-medium">
                {isPixFlow
                  ? 'Fluxo PIX (gateway)'
                  : isCardMachineFlow
                  ? 'Fluxo maquininha (manual)'
                  : 'Fluxo dinheiro (manual)'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isPixFlow
                  ? 'Gera QR Code e confirma automaticamente via webhook.'
                  : isCardMachineFlow
                  ? 'Processa na maquininha e fecha imediatamente no sistema.'
                  : 'Registro direto da venda em caixa.'}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-sm">Subtotal: R$ {subtotal.toFixed(2)}</p>
              <p className="text-sm">Desconto manual: R$ {discount.toFixed(2)}</p>
              <p className="text-sm">Desconto assinatura: R$ {subscriptionDiscount.toFixed(2)}</p>
              <p className="text-sm">Desconto fidelidade: R$ {loyaltyAutomaticDiscount.toFixed(2)}</p>
              <p className="font-semibold">Total: R$ {total.toFixed(2)}</p>
            </div>

            <Button className="w-full" onClick={handleCheckout} disabled={checkoutLoading || cart.length === 0}>
              {checkoutLoading
                ? 'Processando...'
                : isPixFlow
                ? 'Gerar PIX no gateway'
                : isCardMachineFlow
                ? 'Registrar pagamento na maquininha'
                : 'Fechar venda em dinheiro'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {(gatewayQrImage || gatewayQrText || gatewayPaymentUrl) && (
        <Card>
          <CardHeader>
            <CardTitle>Pagamento PIX</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {gatewayQrImage && (
              <img src={gatewayQrImage} alt="QR Code PIX" className="h-72 w-72 rounded border p-2" />
            )}
            {gatewayQrText && (
              <div>
                <Label>PIX copia e cola</Label>
                <Input value={gatewayQrText} readOnly />
              </div>
            )}
            {gatewayPaymentUrl && (
              <Button onClick={() => window.open(gatewayPaymentUrl, '_blank')} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Abrir link de pagamento
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              O pedido sera confirmado automaticamente quando o gateway enviar a confirmacao do pagamento.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>PIX pendentes</CardTitle>
          <Button variant="outline" onClick={fetchPendingPixOrders} disabled={pendingPixLoading}>
            {pendingPixLoading ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingPixLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
          {!pendingPixLoading && pendingPixOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem PIX pendente.</p>
          ) : null}
          {!pendingPixLoading
            ? pendingPixOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <p className="font-medium">{order.customerName || 'Cliente'}</p>
                    <p className="text-xs text-muted-foreground">{order.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">R$ {Number(order.total || 0).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{order.status}</p>
                  </div>
                </div>
              ))
            : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default Pdv;
