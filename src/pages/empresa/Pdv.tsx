import React, { useEffect, useMemo, useState } from 'react';
import { companyService } from '@/services/company';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { useAuth } from '@/contexts/AuthContext';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number | string;
  stockQuantity: number;
}

interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  stockQuantity: number;
}

interface PdvOrder {
  id: string;
  customerName: string | null;
  total: number;
  status: string;
  createdAt: string;
}

const pixKey = import.meta.env.VITE_PIX_KEY || 'contato@evolutech.com';
const pixMerchantName = import.meta.env.VITE_PIX_MERCHANT_NAME || 'EVOLUTECH';
const pixMerchantCity = import.meta.env.VITE_PIX_MERCHANT_CITY || 'SAOPAULO';

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const crc16 = (payload: string) => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

const tlv = (id: string, value: string) => `${id}${value.length.toString().padStart(2, '0')}${value}`;

const buildPixPayload = (amount: number, txid: string) => {
  const gui = tlv('00', 'BR.GOV.BCB.PIX');
  const key = tlv('01', pixKey);
  const merchant = tlv('26', `${gui}${key}`);
  const payloadWithoutCrc = [
    tlv('00', '01'),
    tlv('01', '12'),
    merchant,
    tlv('52', '0000'),
    tlv('53', '986'),
    tlv('54', amount.toFixed(2)),
    tlv('58', 'BR'),
    tlv('59', pixMerchantName.slice(0, 25).toUpperCase()),
    tlv('60', pixMerchantCity.slice(0, 15).toUpperCase()),
    tlv('62', tlv('05', txid.slice(0, 25))),
    '6304',
  ].join('');
  return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`;
};

const Pdv: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');
  const [pixQrCodeDataUrl, setPixQrCodeDataUrl] = useState<string | null>(null);
  const [pixPayload, setPixPayload] = useState<string>('');
  const [pendingPixOrderId, setPendingPixOrderId] = useState<string | null>(null);
  const [confirmingPix, setConfirmingPix] = useState(false);
  const [pendingPixOrders, setPendingPixOrders] = useState<PdvOrder[]>([]);
  const [pendingPixLoading, setPendingPixLoading] = useState(false);
  const [pixSearch, setPixSearch] = useState('');
  const [pixDateFrom, setPixDateFrom] = useState('');
  const [pixDateTo, setPixDateTo] = useState('');
  const [pixPage, setPixPage] = useState(1);
  const [pixPageSize, setPixPageSize] = useState(10);
  const [pixTotal, setPixTotal] = useState(0);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await companyService.listPdvProducts(search);
      setProducts(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar produtos do PDV');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingPixOrders = async () => {
    try {
      setPendingPixLoading(true);
      const data = await companyService.listPdvOrders({
        status: 'pending_pix',
        page: pixPage,
        pageSize: pixPageSize,
        search: pixSearch.trim() || undefined,
        dateFrom: pixDateFrom || undefined,
        dateTo: pixDateTo || undefined,
      });
      setPendingPixOrders(data?.data || []);
      setPixTotal(Number(data?.total || 0));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar PIX pendentes');
    } finally {
      setPendingPixLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchProducts();
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchPendingPixOrders();
    }, 250);
    return () => clearTimeout(timeout);
  }, [pixSearch, pixDateFrom, pixDateTo, pixPage, pixPageSize]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );

  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  const addToCart = (product: Product) => {
    const unitPrice = Number(product.price || 0);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.stockQuantity) {
          toast.error('Estoque insuficiente');
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice,
          quantity: 1,
          stockQuantity: product.stockQuantity,
        },
      ];
    });
  };

  const setItemQty = (productId: string, quantity: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          return { ...item, quantity: Math.max(0, Math.min(quantity, item.stockQuantity)) };
        })
        .filter((item) => item.quantity > 0)
    );
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
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      });

      if (paymentMethod === 'pix') {
        const txid = onlyDigits(String(result?.order?.id || Date.now())).slice(0, 25) || String(Date.now()).slice(0, 25);
        const payload = buildPixPayload(total, txid);
        const dataUrl = await QRCode.toDataURL(payload, { width: 280, margin: 2 });
        setPixPayload(payload);
        setPixQrCodeDataUrl(dataUrl);
        setPendingPixOrderId(result?.order?.id || null);
        toast.success('Pedido PIX criado. Aguardando confirmação de pagamento.');
      } else {
        toast.success('Venda finalizada com sucesso');
        setPendingPixOrderId(null);
        setPixPayload('');
        setPixQrCodeDataUrl(null);
      }

      setCart([]);
      setCustomerName('');
      setDiscount(0);
      fetchProducts();
      fetchPendingPixOrders();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao finalizar venda');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleConfirmPixPayment = async () => {
    if (!pendingPixOrderId) return;
    setConfirmingPix(true);
    try {
      await companyService.confirmPdvPixPayment(pendingPixOrderId, user?.tenantId);
      toast.success('Pagamento PIX confirmado e pedido baixado como pago');
      setPendingPixOrderId(null);
      setPixPayload('');
      setPixQrCodeDataUrl(null);
      fetchProducts();
      fetchPendingPixOrders();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao confirmar pagamento PIX');
    } finally {
      setConfirmingPix(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold lg:text-3xl">PDV</h1>
        <p className="text-muted-foreground">Venda rápida com produtos do estoque</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Buscar produto por nome ou SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {loading ? (
              <div className="py-10 text-center text-muted-foreground">Carregando produtos...</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {products.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className="rounded-lg border p-3 text-left transition hover:border-primary"
                  >
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.sku || 'Sem SKU'}</p>
                    <p className="text-sm">Estoque: {product.stockQuantity}</p>
                    <p className="font-semibold">R$ {Number(product.price || 0).toFixed(2)}</p>
                  </button>
                ))}
                {products.length === 0 && (
                  <div className="md:col-span-2 py-8 text-center text-muted-foreground">
                    Nenhum produto disponível para venda
                  </div>
                )}
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
                <div key={item.productId} className="rounded border p-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={item.stockQuantity}
                      value={item.quantity}
                      onChange={(e) => setItemQty(item.productId, Number(e.target.value))}
                    />
                    <p className="text-sm font-medium whitespace-nowrap">
                      R$ {(item.unitPrice * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
              {cart.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item no carrinho</p>}
            </div>

            <div className="space-y-2">
              <Label>Cliente (opcional)</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome do cliente" />
            </div>

            <div className="space-y-2">
              <Label>Desconto</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Pagamento</Label>
              <Select value={paymentMethod} onValueChange={(value: 'dinheiro' | 'cartao' | 'pix') => setPaymentMethod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-sm">Subtotal: R$ {subtotal.toFixed(2)}</p>
              <p className="text-sm">Desconto: R$ {discount.toFixed(2)}</p>
              <p className="font-semibold">Total: R$ {total.toFixed(2)}</p>
            </div>

            <Button className="w-full" onClick={handleCheckout} disabled={checkoutLoading || cart.length === 0}>
              {checkoutLoading ? 'Finalizando...' : 'Finalizar Venda'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {paymentMethod === 'pix' && pixQrCodeDataUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Pagamento PIX</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <img src={pixQrCodeDataUrl} alt="QR Code PIX" className="h-72 w-72 rounded border p-2" />
            <div>
              <Label>Copia e cola PIX</Label>
              <Input value={pixPayload} readOnly />
            </div>
            <Button onClick={handleConfirmPixPayment} disabled={!pendingPixOrderId || confirmingPix}>
              {confirmingPix ? 'Confirmando...' : 'Confirmar Pagamento PIX'}
            </Button>
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
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="Buscar por cliente ou ID..."
              value={pixSearch}
              onChange={(e) => {
                setPixPage(1);
                setPixSearch(e.target.value);
              }}
            />
            <Input
              type="date"
              value={pixDateFrom}
              onChange={(e) => {
                setPixPage(1);
                setPixDateFrom(e.target.value);
              }}
            />
            <Input
              type="date"
              value={pixDateTo}
              onChange={(e) => {
                setPixPage(1);
                setPixDateTo(e.target.value);
              }}
            />
          </div>
          {pendingPixOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento PIX pendente.</p>
          ) : (
            pendingPixOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="text-sm font-medium">Pedido #{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.customerName || 'Sem cliente'} • R$ {Number(order.total || 0).toFixed(2)}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await companyService.confirmPdvPixPayment(order.id, user?.tenantId);
                      toast.success('PIX confirmado com sucesso');
                      if (pendingPixOrderId === order.id) {
                        setPendingPixOrderId(null);
                        setPixPayload('');
                        setPixQrCodeDataUrl(null);
                      }
                      fetchPendingPixOrders();
                    } catch (error: any) {
                      toast.error(error.message || 'Erro ao confirmar PIX');
                    }
                  }}
                >
                  Confirmar
                </Button>
              </div>
            ))
          )}
          <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {pixTotal} pendente(s) • página {pixPage}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(pixPageSize)}
                onValueChange={(value) => {
                  setPixPage(1);
                  setPixPageSize(Number(value) || 10);
                }}
              >
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={pixPage <= 1 || pendingPixLoading}
                onClick={() => setPixPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pendingPixLoading || pixPage * pixPageSize >= pixTotal}
                onClick={() => setPixPage((prev) => prev + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Pdv;
