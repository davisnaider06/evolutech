import crypto from 'crypto';
import https from 'https';
import { prisma } from '../db';
import { decryptSecret } from '../utils/crypto.util';

type JsonObject = Record<string, any>;

export class PaymentServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PaymentServiceError';
    this.statusCode = statusCode;
  }
}

function requestStripe(
  method: 'GET' | 'POST',
  path: string,
  secretKey: string,
  payload?: string
): Promise<JsonObject> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.stripe.com',
        method,
        path,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': payload ? Buffer.byteLength(payload) : 0,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data || '{}');
            if ((res.statusCode || 500) >= 400) {
              return reject(
                new PaymentServiceError(
                  parsed?.error?.message || 'Falha na API do Stripe',
                  res.statusCode || 502
                )
              );
            }
            resolve(parsed);
          } catch (err: any) {
            reject(new PaymentServiceError(err?.message || 'Resposta invalida do Stripe', 502));
          }
        });
      }
    );

    req.on('error', (error) => reject(new PaymentServiceError(error.message || 'Erro de rede', 502)));
    if (payload) req.write(payload);
    req.end();
  });
}

function requestJson(
  method: 'GET' | 'POST',
  hostname: string,
  path: string,
  token: string,
  payload?: JsonObject,
  extraHeaders?: Record<string, string>
): Promise<JsonObject> {
  return new Promise((resolve, reject) => {
    const rawPayload = payload ? JSON.stringify(payload) : undefined;
    const req = https.request(
      {
        hostname,
        method,
        path,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(extraHeaders || {}),
          ...(rawPayload ? { 'Content-Length': Buffer.byteLength(rawPayload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data || '{}');
            if ((res.statusCode || 500) >= 400) {
              return reject(
                new PaymentServiceError(
                  parsed?.message || parsed?.error || 'Falha na API do gateway',
                  res.statusCode || 502
                )
              );
            }
            resolve(parsed);
          } catch (err: any) {
            reject(new PaymentServiceError(err?.message || 'Resposta invalida do gateway', 502));
          }
        });
      }
    );

    req.on('error', (error) => reject(new PaymentServiceError(error.message || 'Erro de rede', 502)));
    if (rawPayload) req.write(rawPayload);
    req.end();
  });
}

export class PaymentService {
  private buildStripeForm(values: Record<string, string | number | boolean>) {
    const form = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => form.append(key, String(value)));
    return form.toString();
  }

  private async syncCompanyMonthlyRevenue(tx: any, companyId: string, referenceDate: Date) {
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);

    const agg = await tx.order.aggregate({
      where: {
        companyId,
        status: 'paid',
        createdAt: { gte: start, lt: end },
      },
      _sum: { total: true },
    });

    await tx.company.update({
      where: { id: companyId },
      data: { monthlyRevenue: Number(agg._sum.total || 0) },
    });
  }

  private async finalizePaymentStatus(params: {
    companyId: string;
    provider: string;
    externalPaymentId: string;
    newStatus: string;
    paidAt?: Date | null;
    webhookPayload?: any;
  }) {
    const txPayment = await (prisma as any).paymentTransaction.findFirst({
      where: {
        companyId: params.companyId,
        provider: params.provider,
        externalPaymentId: params.externalPaymentId,
      },
      include: { order: true },
    });

    if (!txPayment) return { received: true, ignored: true };

    const normalized = String(params.newStatus || '').toLowerCase();
    const paidStatuses = new Set(['paid', 'approved', 'succeeded']);
    const failedStatuses = new Set(['failed', 'cancelled', 'canceled', 'rejected']);
    const isPaid = paidStatuses.has(normalized);
    const isFailed = failedStatuses.has(normalized);

    await prisma.$transaction(async (tx) => {
      await (tx as any).paymentTransaction.update({
        where: { id: txPayment.id },
        data: {
          status: isPaid ? 'paid' : isFailed ? 'failed' : normalized || txPayment.status,
          paidAt: isPaid ? params.paidAt || new Date() : null,
          gatewayResponse: params.webhookPayload || txPayment.gatewayResponse,
        },
      });

      if (isPaid && txPayment.order?.status !== 'paid') {
        const updatedOrder = await tx.order.update({
          where: { id: txPayment.orderId },
          data: { status: 'paid' },
        });

        await (tx as any).billingCharge.updateMany({
          where: { orderId: txPayment.orderId },
          data: { status: 'paid', paidAt: new Date() },
        });

        await this.syncCompanyMonthlyRevenue(tx, params.companyId, updatedOrder.createdAt);

        await tx.auditLog.create({
          data: {
            companyId: params.companyId,
            action: 'PAYMENT_WEBHOOK_CONFIRMED',
            resource: 'orders',
            details: {
              orderId: txPayment.orderId,
              provider: params.provider,
              externalPaymentId: params.externalPaymentId,
              paymentStatus: normalized,
            },
          },
        });
      } else if (isFailed) {
        await tx.order.update({
          where: { id: txPayment.orderId },
          data: { status: 'failed' },
        });
        await (tx as any).billingCharge.updateMany({
          where: { orderId: txPayment.orderId },
          data: { status: 'failed' },
        });
      }
    });

    return { received: true, processed: true };
  }

  async getCompanyActiveGateway(companyId: string, provider?: string) {
    return (prisma as any).paymentGateway.findFirst({
      where: {
        companyId,
        isActive: true,
        ...(provider ? { provider } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async validateGatewayCredentials(params: {
    provider: string;
    environment?: string;
    publicKey?: string | null;
    secretKey?: string | null;
  }) {
    const provider = String(params.provider || '').toLowerCase();
    const environment = String(params.environment || 'sandbox').toLowerCase();
    const secretKey = String(params.secretKey || '').trim();

    if (!secretKey) {
      throw new PaymentServiceError('Secret key obrigatoria', 400);
    }

    if (provider === 'stripe') {
      const account = await requestStripe('GET', '/v1/account', secretKey);
      return {
        ok: true,
        provider,
        accountId: account?.id || null,
        accountName: account?.business_profile?.name || account?.email || null,
      };
    }

    if (provider === 'mercadopago') {
      const me = await requestJson('GET', 'api.mercadopago.com', '/users/me', secretKey);
      return {
        ok: true,
        provider,
        accountId: me?.id ? String(me.id) : null,
        accountName: me?.nickname || me?.email || null,
      };
    }

    if (provider === 'pagbank') {
      const base =
        environment === 'producao'
          ? 'api.pagseguro.com'
          : 'sandbox.api.pagseguro.com';
      // endpoint simples para validar bearer token
      const account = await requestJson('GET', base, '/public-keys', secretKey);
      return {
        ok: true,
        provider,
        accountId: account?.id ? String(account.id) : null,
        accountName: null,
      };
    }

    throw new PaymentServiceError('Provedor nao suportado', 400);
  }

  async createStripePixPayment(
    tx: any,
    params: {
      companyId: string;
      orderId: string;
      amount: number;
      customerName?: string | null;
    }
  ) {
    const gateway = await (tx as any).paymentGateway.findFirst({
      where: {
        companyId: params.companyId,
        provider: 'stripe',
        isActive: true,
      },
    });

    if (!gateway) {
      throw new PaymentServiceError('Nenhum gateway Stripe ativo para esta empresa', 400);
    }

    const secretKey = decryptSecret(gateway.secretKeyEncrypted || '');
    if (!secretKey) {
      throw new PaymentServiceError('Secret key do Stripe nao configurada', 400);
    }

    const amountInCents = Math.round(Number(params.amount || 0) * 100);
    if (amountInCents <= 0) {
      throw new PaymentServiceError('Valor invalido para pagamento', 400);
    }

    const formBody = this.buildStripeForm({
      amount: amountInCents,
      currency: 'brl',
      confirm: 'true',
      description: `Pedido ${params.orderId}`,
      'payment_method_types[]': 'pix',
      'payment_method_data[type]': 'pix',
      'metadata[order_id]': params.orderId,
      'metadata[company_id]': params.companyId,
      ...(params.customerName ? { 'metadata[customer_name]': params.customerName } : {}),
    });

    const intent = await requestStripe('POST', '/v1/payment_intents', secretKey, formBody);

    const qrText =
      intent?.next_action?.pix_display_qr_code?.data ||
      intent?.next_action?.display_qr_code?.data ||
      null;
    const qrImageUrl =
      intent?.next_action?.pix_display_qr_code?.image_url_png ||
      intent?.next_action?.display_qr_code?.image_url_png ||
      null;

    const payment = await (tx as any).paymentTransaction.create({
      data: {
        companyId: params.companyId,
        orderId: params.orderId,
        gatewayId: gateway.id,
        provider: 'stripe',
        paymentMethod: 'pix',
        externalPaymentId: intent.id || null,
        status: intent.status || 'requires_action',
        amount: params.amount,
        currency: 'brl',
        qrCodeText: qrText,
        qrCodeImageUrl: qrImageUrl,
        paymentLinkUrl: null,
        gatewayResponse: intent,
      },
    });

    return {
      paymentId: payment.id,
      externalPaymentId: payment.externalPaymentId,
      provider: 'stripe',
      status: payment.status,
      qrCodeText: payment.qrCodeText,
      qrCodeImageUrl: payment.qrCodeImageUrl,
      raw: intent,
    };
  }

  async createStripeCardPaymentLink(
    tx: any,
    params: {
      companyId: string;
      orderId: string;
      amount: number;
      customerName?: string | null;
      paymentMethod: 'credito' | 'debito' | 'cartao';
    }
  ) {
    const gateway = await (tx as any).paymentGateway.findFirst({
      where: { companyId: params.companyId, provider: 'stripe', isActive: true },
    });
    if (!gateway) throw new PaymentServiceError('Nenhum gateway Stripe ativo para esta empresa', 400);

    const secretKey = decryptSecret(gateway.secretKeyEncrypted || '');
    if (!secretKey) throw new PaymentServiceError('Secret key do Stripe nao configurada', 400);

    const amountInCents = Math.round(Number(params.amount || 0) * 100);
    if (amountInCents <= 0) throw new PaymentServiceError('Valor invalido para pagamento', 400);

    const appUrl = process.env.APP_PUBLIC_URL || 'http://localhost:5173';
    const formBody = this.buildStripeForm({
      mode: 'payment',
      'line_items[0][price_data][currency]': 'brl',
      'line_items[0][price_data][product_data][name]': `Pedido ${params.orderId}`,
      'line_items[0][price_data][unit_amount]': amountInCents,
      'line_items[0][quantity]': 1,
      success_url: `${appUrl}/empresa/pedidos?payment=success&order=${params.orderId}`,
      cancel_url: `${appUrl}/empresa/pedidos?payment=cancel&order=${params.orderId}`,
      'metadata[order_id]': params.orderId,
      'metadata[company_id]': params.companyId,
      ...(params.customerName ? { 'metadata[customer_name]': params.customerName } : {}),
    });

    const session = await requestStripe('POST', '/v1/checkout/sessions', secretKey, formBody);

    const created = await (tx as any).paymentTransaction.create({
      data: {
        companyId: params.companyId,
        orderId: params.orderId,
        gatewayId: gateway.id,
        provider: 'stripe',
        paymentMethod: params.paymentMethod,
        externalPaymentId: session?.id || null,
        status: String(session?.payment_status || 'pending'),
        amount: params.amount,
        currency: 'brl',
        qrCodeText: null,
        qrCodeImageUrl: null,
        paymentLinkUrl: session?.url || null,
        gatewayResponse: session,
      },
    });

    return {
      paymentId: created.id,
      externalPaymentId: created.externalPaymentId,
      provider: 'stripe',
      status: created.status,
      paymentUrl: created.paymentLinkUrl,
      qrCodeText: null,
      qrCodeImageUrl: null,
      raw: session,
    };
  }

  async createMercadoPagoPixPayment(
    tx: any,
    params: {
      companyId: string;
      orderId: string;
      amount: number;
      customerName?: string | null;
      customerEmail?: string | null;
    }
  ) {
    const gateway = await (tx as any).paymentGateway.findFirst({
      where: {
        companyId: params.companyId,
        provider: 'mercadopago',
        isActive: true,
      },
    });

    if (!gateway) {
      throw new PaymentServiceError('Nenhum gateway Mercado Pago ativo para esta empresa', 400);
    }

    const secretKey = decryptSecret(gateway.secretKeyEncrypted || '');
    if (!secretKey) {
      throw new PaymentServiceError('Access token do Mercado Pago nao configurado', 400);
    }

    const amount = Number(params.amount || 0);
    if (amount <= 0) {
      throw new PaymentServiceError('Valor invalido para pagamento', 400);
    }

    const payload = {
      transaction_amount: amount,
      description: `Pedido ${params.orderId}`,
      payment_method_id: 'pix',
      payer: {
        email: String(params.customerEmail || '').trim() || 'no-reply@evolutech.com.br',
        first_name: params.customerName || 'Cliente',
      },
      metadata: {
        order_id: params.orderId,
        company_id: params.companyId,
      },
    };

    const payment = await requestJson(
      'POST',
      'api.mercadopago.com',
      '/v1/payments',
      secretKey,
      payload,
      { 'X-Idempotency-Key': `${params.companyId}-${params.orderId}-pix` }
    );

    const txData = payment?.point_of_interaction?.transaction_data || {};
    const qrText = txData?.qr_code || null;
    const qrImageUrl = txData?.qr_code_base64
      ? `data:image/png;base64,${txData.qr_code_base64}`
      : null;

    const created = await (tx as any).paymentTransaction.create({
      data: {
        companyId: params.companyId,
        orderId: params.orderId,
        gatewayId: gateway.id,
        provider: 'mercadopago',
        paymentMethod: 'pix',
        externalPaymentId: payment?.id ? String(payment.id) : null,
        status: String(payment?.status || 'pending'),
        amount,
        currency: String(payment?.currency_id || 'BRL').toLowerCase(),
        qrCodeText: qrText,
        qrCodeImageUrl: qrImageUrl,
        paymentLinkUrl: null,
        gatewayResponse: payment,
      },
    });

    return {
      paymentId: created.id,
      externalPaymentId: created.externalPaymentId,
      provider: 'mercadopago',
      status: created.status,
      qrCodeText: created.qrCodeText,
      qrCodeImageUrl: created.qrCodeImageUrl,
      raw: payment,
    };
  }

  async createMercadoPagoPaymentLink(
    tx: any,
    params: {
      companyId: string;
      orderId: string;
      amount: number;
      customerName?: string | null;
      paymentMethod: 'credito' | 'debito' | 'cartao';
    }
  ) {
    const gateway = await (tx as any).paymentGateway.findFirst({
      where: { companyId: params.companyId, provider: 'mercadopago', isActive: true },
    });
    if (!gateway) {
      throw new PaymentServiceError('Nenhum gateway Mercado Pago ativo para esta empresa', 400);
    }

    const secretKey = decryptSecret(gateway.secretKeyEncrypted || '');
    if (!secretKey) throw new PaymentServiceError('Access token do Mercado Pago nao configurado', 400);

    const amount = Number(params.amount || 0);
    if (amount <= 0) throw new PaymentServiceError('Valor invalido para pagamento', 400);

    const appUrl = process.env.APP_PUBLIC_URL || 'http://localhost:5173';
    const preference = await requestJson(
      'POST',
      'api.mercadopago.com',
      '/checkout/preferences',
      secretKey,
      {
        items: [
          {
            title: `Pedido ${params.orderId}`,
            quantity: 1,
            unit_price: amount,
            currency_id: 'BRL',
          },
        ],
        metadata: {
          order_id: params.orderId,
          company_id: params.companyId,
          customer_name: params.customerName || null,
        },
        back_urls: {
          success: `${appUrl}/empresa/pedidos?payment=success&order=${params.orderId}`,
          failure: `${appUrl}/empresa/pedidos?payment=failure&order=${params.orderId}`,
          pending: `${appUrl}/empresa/pedidos?payment=pending&order=${params.orderId}`,
        },
        auto_return: 'approved',
      },
      { 'X-Idempotency-Key': `${params.companyId}-${params.orderId}-link` }
    );

    const link = preference?.init_point || preference?.sandbox_init_point || null;
    const created = await (tx as any).paymentTransaction.create({
      data: {
        companyId: params.companyId,
        orderId: params.orderId,
        gatewayId: gateway.id,
        provider: 'mercadopago',
        paymentMethod: params.paymentMethod,
        externalPaymentId: preference?.id ? String(preference.id) : null,
        status: 'pending',
        amount,
        currency: 'brl',
        qrCodeText: null,
        qrCodeImageUrl: null,
        paymentLinkUrl: link,
        gatewayResponse: preference,
      },
    });

    return {
      paymentId: created.id,
      externalPaymentId: created.externalPaymentId,
      provider: 'mercadopago',
      status: created.status,
      paymentUrl: created.paymentLinkUrl,
      qrCodeText: null,
      qrCodeImageUrl: null,
      raw: preference,
    };
  }

  async createPagBankPixPayment(
    tx: any,
    params: {
      companyId: string;
      orderId: string;
      amount: number;
      customerName?: string | null;
    }
  ) {
    const gateway = await (tx as any).paymentGateway.findFirst({
      where: {
        companyId: params.companyId,
        provider: 'pagbank',
        isActive: true,
      },
    });

    if (!gateway) {
      throw new PaymentServiceError('Nenhum gateway PagBank ativo para esta empresa', 400);
    }

    const secretKey = decryptSecret(gateway.secretKeyEncrypted || '');
    if (!secretKey) {
      throw new PaymentServiceError('Token do PagBank nao configurado', 400);
    }

    const amount = Number(params.amount || 0);
    if (amount <= 0) {
      throw new PaymentServiceError('Valor invalido para pagamento', 400);
    }

    const env = String(gateway.environment || 'sandbox').toLowerCase();
    const host = env === 'producao' ? 'api.pagseguro.com' : 'sandbox.api.pagseguro.com';
    const referenceId = `order_${params.orderId}`;

    const payload = {
      reference_id: referenceId,
      customer: {
        name: params.customerName || 'Cliente',
      },
      items: [
        {
          reference_id: params.orderId,
          name: `Pedido ${params.orderId}`,
          quantity: 1,
          unit_amount: Math.round(amount * 100),
        },
      ],
      qr_codes: [
        {
          amount: {
            value: Math.round(amount * 100),
          },
          expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
      ],
    };

    const order = await requestJson(
      'POST',
      host,
      '/orders',
      secretKey,
      payload,
      { 'x-idempotency-key': `${params.companyId}-${params.orderId}` }
    );

    const qrCode = Array.isArray(order?.qr_codes) ? order.qr_codes[0] : null;
    const qrText =
      qrCode?.text ||
      qrCode?.links?.find?.((l: any) => l?.rel === 'EMV')?.href ||
      null;
    const qrImageUrl =
      qrCode?.links?.find?.((l: any) => l?.rel === 'QRCODE.PNG')?.href ||
      qrCode?.links?.find?.((l: any) => l?.rel === 'QRCODE')?.href ||
      null;
    const externalId = String(order?.id || referenceId);

    const created = await (tx as any).paymentTransaction.create({
      data: {
        companyId: params.companyId,
        orderId: params.orderId,
        gatewayId: gateway.id,
        provider: 'pagbank',
        paymentMethod: 'pix',
        externalPaymentId: externalId,
        status: String(order?.status || 'pending'),
        amount,
        currency: 'brl',
        qrCodeText: qrText,
        qrCodeImageUrl: qrImageUrl,
        paymentLinkUrl: null,
        gatewayResponse: order,
      },
    });

    return {
      paymentId: created.id,
      externalPaymentId: created.externalPaymentId,
      provider: 'pagbank',
      status: created.status,
      qrCodeText: created.qrCodeText,
      qrCodeImageUrl: created.qrCodeImageUrl,
      raw: order,
    };
  }

  async createPagBankPaymentLink(
    tx: any,
    params: {
      companyId: string;
      orderId: string;
      amount: number;
      customerName?: string | null;
      paymentMethod: 'credito' | 'debito' | 'cartao';
    }
  ) {
    const gateway = await (tx as any).paymentGateway.findFirst({
      where: { companyId: params.companyId, provider: 'pagbank', isActive: true },
    });
    if (!gateway) throw new PaymentServiceError('Nenhum gateway PagBank ativo para esta empresa', 400);

    const secretKey = decryptSecret(gateway.secretKeyEncrypted || '');
    if (!secretKey) throw new PaymentServiceError('Token do PagBank nao configurado', 400);

    const amount = Number(params.amount || 0);
    if (amount <= 0) throw new PaymentServiceError('Valor invalido para pagamento', 400);

    const env = String(gateway.environment || 'sandbox').toLowerCase();
    const host = env === 'producao' ? 'api.pagseguro.com' : 'sandbox.api.pagseguro.com';
    const payload = {
      reference_id: `order_${params.orderId}`,
      customer: {
        name: params.customerName || 'Cliente',
      },
      items: [
        {
          reference_id: params.orderId,
          name: `Pedido ${params.orderId}`,
          quantity: 1,
          unit_amount: Math.round(amount * 100),
        },
      ],
      payment_methods: ['CREDIT_CARD', 'DEBIT_CARD'],
    };

    const order = await requestJson(
      'POST',
      host,
      '/orders',
      secretKey,
      payload,
      { 'x-idempotency-key': `${params.companyId}-${params.orderId}-card` }
    );

    const paymentUrl =
      order?.links?.find?.((l: any) => l?.rel === 'PAY')?.href ||
      order?.links?.find?.((l: any) => l?.rel === 'SELF')?.href ||
      null;

    const created = await (tx as any).paymentTransaction.create({
      data: {
        companyId: params.companyId,
        orderId: params.orderId,
        gatewayId: gateway.id,
        provider: 'pagbank',
        paymentMethod: params.paymentMethod,
        externalPaymentId: String(order?.id || `order_${params.orderId}`),
        status: String(order?.status || 'pending'),
        amount,
        currency: 'brl',
        qrCodeText: null,
        qrCodeImageUrl: null,
        paymentLinkUrl: paymentUrl,
        gatewayResponse: order,
      },
    });

    return {
      paymentId: created.id,
      externalPaymentId: created.externalPaymentId,
      provider: 'pagbank',
      status: created.status,
      paymentUrl: created.paymentLinkUrl,
      qrCodeText: null,
      qrCodeImageUrl: null,
      raw: order,
    };
  }

  private verifyStripeSignature(rawBody: string, signatureHeader: string, webhookSecret: string) {
    const parts = String(signatureHeader || '')
      .split(',')
      .reduce<Record<string, string>>((acc, item) => {
        const [k, v] = item.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});

    const timestamp = parts.t;
    const expectedV1 = parts.v1;
    if (!timestamp || !expectedV1) {
      throw new PaymentServiceError('Assinatura Stripe invalida', 400);
    }

    const payload = `${timestamp}.${rawBody}`;
    const digest = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
    if (digest !== expectedV1) {
      throw new PaymentServiceError('Assinatura Stripe nao confere', 400);
    }
  }

  async handleStripeWebhook(companyId: string, rawBody: string, signatureHeader?: string) {
    const gateway = await (prisma as any).paymentGateway.findFirst({
      where: {
        companyId,
        provider: 'stripe',
        isActive: true,
      },
    });

    if (!gateway) {
      throw new PaymentServiceError('Gateway Stripe nao encontrado para empresa', 404);
    }

    const webhookSecret = decryptSecret(gateway.webhookSecretEncrypted || '');
    if (webhookSecret) {
      this.verifyStripeSignature(rawBody, signatureHeader || '', webhookSecret);
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new PaymentServiceError('Payload webhook invalido', 400);
    }

    const intent = event?.data?.object;
    const paymentIntentId = intent?.id as string | undefined;
    if (!paymentIntentId) {
      return { received: true, ignored: true };
    }

    const isPaid = event?.type === 'payment_intent.succeeded' || intent?.status === 'succeeded';
    const isFailed =
      event?.type === 'payment_intent.payment_failed' ||
      event?.type === 'payment_intent.canceled' ||
      intent?.status === 'canceled';

    return this.finalizePaymentStatus({
      companyId,
      provider: 'stripe',
      externalPaymentId: paymentIntentId,
      newStatus: isPaid ? 'paid' : isFailed ? 'failed' : String(intent?.status || 'pending'),
      paidAt: isPaid ? new Date() : null,
      webhookPayload: event,
    });
  }

  async handleMercadoPagoWebhook(companyId: string, payload: any) {
    const gateway = await (prisma as any).paymentGateway.findFirst({
      where: {
        companyId,
        provider: 'mercadopago',
        isActive: true,
      },
    });
    if (!gateway) throw new PaymentServiceError('Gateway Mercado Pago nao encontrado', 404);

    const paymentId = payload?.data?.id || payload?.id;
    if (!paymentId) return { received: true, ignored: true };

    const token = decryptSecret(gateway.secretKeyEncrypted || '');
    if (!token) throw new PaymentServiceError('Token Mercado Pago nao configurado', 400);

    const payment = await requestJson(
      'GET',
      'api.mercadopago.com',
      `/v1/payments/${paymentId}`,
      token
    );

    return this.finalizePaymentStatus({
      companyId,
      provider: 'mercadopago',
      externalPaymentId: String(payment?.id || paymentId),
      newStatus: String(payment?.status || 'pending'),
      paidAt: payment?.date_approved ? new Date(payment.date_approved) : null,
      webhookPayload: payment,
    });
  }

  async handlePagBankWebhook(companyId: string, payload: any) {
    const gateway = await (prisma as any).paymentGateway.findFirst({
      where: {
        companyId,
        provider: 'pagbank',
        isActive: true,
      },
    });
    if (!gateway) throw new PaymentServiceError('Gateway PagBank nao encontrado', 404);

    const externalId =
      payload?.id ||
      payload?.order?.id ||
      payload?.charges?.[0]?.id ||
      payload?.reference_id;
    if (!externalId) return { received: true, ignored: true };

    const statusRaw =
      payload?.status ||
      payload?.order?.status ||
      payload?.charges?.[0]?.status ||
      'pending';

    const mapStatus: Record<string, string> = {
      PAID: 'paid',
      COMPLETED: 'paid',
      CANCELED: 'failed',
      DECLINED: 'failed',
      FAILED: 'failed',
    };

    const normalizedStatus = mapStatus[String(statusRaw).toUpperCase()] || String(statusRaw).toLowerCase();

    return this.finalizePaymentStatus({
      companyId,
      provider: 'pagbank',
      externalPaymentId: String(externalId),
      newStatus: normalizedStatus,
      paidAt: normalizedStatus === 'paid' ? new Date() : null,
      webhookPayload: payload,
    });
  }
}
