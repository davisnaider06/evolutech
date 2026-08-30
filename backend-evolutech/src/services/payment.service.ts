import crypto from 'crypto';
import https from 'https';
import { prisma } from '../db';
import { decryptSecret } from '../utils/crypto.util';
import { notificationService } from './notification.service';

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

    // Preenchido dentro da transacao para o e-mail ser enviado depois do commit.
    let assinaturaAtivada: any = null;

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

        // Se este pedido cobrava uma mensalidade, e ela que precisa ser ativada.
        // Sem isto o cliente paga e a assinatura fica presa em "pending" para
        // sempre: o PDV nao abate o plano e as regras de plano nao valem.
        assinaturaAtivada = await this.activateSubscriptionForOrder(tx, txPayment.orderId);

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
        // Pagamento recusado: a mensalidade daquele pedido nao entra em vigor.
        await (tx as any).customerSubscription.updateMany({
          where: { orderId: txPayment.orderId, status: 'pending' },
          data: { status: 'canceled' },
        });
      }
    });

    // Fora da transacao de proposito: e-mail e chamadas ao gateway nao podem
    // segurar nem desfazer a confirmacao do pagamento.
    if (assinaturaAtivada) {
      // Mensalidade paga no cartao: guarda o cartao para os proximos ciclos.
      const noCartao = ['credito', 'debito', 'cartao'].includes(
        String(assinaturaAtivada.paymentMethod || '').toLowerCase()
      );
      if (noCartao && params.provider === 'stripe' && params.externalPaymentId) {
        await this.salvarCartaoDaSessao({
          companyId: params.companyId,
          customerId: assinaturaAtivada.customerId,
          sessionId: params.externalPaymentId,
        });
      }
      await this.avisarAssinaturaAtivada(assinaturaAtivada);
    }

    return { received: true, processed: true };
  }

  /**
   * Ativa a mensalidade vinculada a um pedido pago e devolve o que o
   * e-mail de confirmacao precisa. Retorna null se o pedido nao for de
   * assinatura, ou se ela ja estiver ativa.
   */
  private async activateSubscriptionForOrder(tx: any, orderId: string) {
    const assinatura = await tx.customerSubscription.findFirst({
      where: { orderId, status: 'pending' },
      include: {
        customer: { select: { name: true, email: true } },
        company: { select: { name: true } },
        plan: { select: { name: true, isUnlimited: true } },
      },
    });
    if (!assinatura) return null;

    await tx.customerSubscription.update({
      where: { id: assinatura.id },
      data: { status: 'active' },
    });

    return assinatura;
  }

  private async avisarAssinaturaAtivada(assinatura: any) {
    try {
      await notificationService.assinaturaAtivada({
        to: assinatura.customer?.email || '',
        customerName: assinatura.customer?.name || 'cliente',
        companyName: assinatura.company?.name || 'Barbearia',
        planName: assinatura.plan?.name || 'Plano',
        amount: Number(assinatura.amount || 0),
        endAt: assinatura.endAt,
        isUnlimited: Boolean(assinatura.plan?.isUnlimited),
        remainingServices: assinatura.remainingServices ?? null,
      });
    } catch (error: any) {
      console.error('[payment] falha ao avisar assinatura ativada:', error?.message);
    }
  }

  /**
   * Guarda o cartao que o cliente acabou de usar, para os proximos ciclos
   * da mensalidade. So roda quando o pedido pago era de assinatura no cartao.
   *
   * O Stripe devolve, na sessao de checkout, o cliente criado e o metodo de
   * pagamento usado. Sao essas duas referencias que precisamos guardar —
   * nunca o numero do cartao, que nem chega ate aqui.
   */
  private async salvarCartaoDaSessao(params: {
    companyId: string;
    customerId: string;
    sessionId: string;
  }) {
    try {
      const gateway = await (prisma as any).paymentGateway.findFirst({
        where: { companyId: params.companyId, provider: 'stripe', isActive: true },
      });
      if (!gateway) return null;
      const secretKey = decryptSecret(gateway.secretKeyEncrypted || '');
      if (!secretKey) return null;

      const sessao = await requestStripe(
        'GET',
        `/v1/checkout/sessions/${encodeURIComponent(params.sessionId)}`,
        secretKey
      );
      const externalCustomerId = String(sessao?.customer || '').trim();
      const paymentIntentId = String(sessao?.payment_intent || '').trim();
      if (!externalCustomerId || !paymentIntentId) return null;

      const intent = await requestStripe(
        'GET',
        `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
        secretKey
      );
      const externalPaymentMethodId = String(intent?.payment_method || '').trim();
      if (!externalPaymentMethodId) return null;

      const metodo = await requestStripe(
        'GET',
        `/v1/payment_methods/${encodeURIComponent(externalPaymentMethodId)}`,
        secretKey
      );
      const cartao = metodo?.card || {};

      // Um cartao por cliente como padrao: o novo assume o lugar do anterior.
      await (prisma as any).customerPaymentMethod.updateMany({
        where: { companyId: params.companyId, customerId: params.customerId },
        data: { isDefault: false },
      });

      return await (prisma as any).customerPaymentMethod.upsert({
        where: {
          companyId_customerId_provider_externalPaymentMethodId: {
            companyId: params.companyId,
            customerId: params.customerId,
            provider: 'stripe',
            externalPaymentMethodId,
          },
        },
        update: {
          externalCustomerId,
          brand: cartao.brand || null,
          last4: cartao.last4 || null,
          expMonth: cartao.exp_month ? Number(cartao.exp_month) : null,
          expYear: cartao.exp_year ? Number(cartao.exp_year) : null,
          isDefault: true,
          isActive: true,
        },
        create: {
          companyId: params.companyId,
          customerId: params.customerId,
          provider: 'stripe',
          externalCustomerId,
          externalPaymentMethodId,
          brand: cartao.brand || null,
          last4: cartao.last4 || null,
          expMonth: cartao.exp_month ? Number(cartao.exp_month) : null,
          expYear: cartao.exp_year ? Number(cartao.exp_year) : null,
          isDefault: true,
          isActive: true,
        },
      });
    } catch (error: any) {
      // Falhar aqui nao pode invalidar um pagamento que ja foi confirmado.
      console.error('[payment] nao consegui salvar o cartao:', error?.message);
      return null;
    }
  }

  /**
   * Cobra um valor no cartao ja salvo do cliente, sem ele estar presente.
   *
   * Usado pela regua das mensalidades no dia do vencimento. Devolve
   * { ok: true } quando o Stripe autoriza na hora. Cartao recusado ou que
   * exige autenticacao do titular retorna ok:false com o motivo — nesses
   * casos a assinatura nao e renovada.
   */
  async cobrarNoCartaoSalvo(params: {
    companyId: string;
    customerId: string;
    orderId: string;
    amount: number;
    descricao: string;
  }): Promise<{ ok: boolean; motivo?: string; externalPaymentId?: string }> {
    const cartao = await (prisma as any).customerPaymentMethod.findFirst({
      where: { companyId: params.companyId, customerId: params.customerId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    if (!cartao) return { ok: false, motivo: 'cliente sem cartao salvo' };
    if (cartao.provider !== 'stripe') {
      return { ok: false, motivo: `cobranca recorrente ainda nao suportada em ${cartao.provider}` };
    }

    const gateway = await (prisma as any).paymentGateway.findFirst({
      where: { companyId: params.companyId, provider: 'stripe', isActive: true },
    });
    if (!gateway) return { ok: false, motivo: 'gateway Stripe inativo' };
    const secretKey = decryptSecret(gateway.secretKeyEncrypted || '');
    if (!secretKey) return { ok: false, motivo: 'secret key do Stripe ausente' };

    const amountInCents = Math.round(Number(params.amount || 0) * 100);
    if (amountInCents <= 0) return { ok: false, motivo: 'valor invalido' };

    try {
      const intent = await requestStripe(
        'POST',
        '/v1/payment_intents',
        secretKey,
        this.buildStripeForm({
          amount: amountInCents,
          currency: 'brl',
          customer: cartao.externalCustomerId,
          payment_method: cartao.externalPaymentMethodId,
          // off_session + confirm: cobra sem o cliente estar na tela.
          off_session: 'true',
          confirm: 'true',
          description: params.descricao,
          'metadata[order_id]': params.orderId,
          'metadata[company_id]': params.companyId,
          'metadata[recorrente]': 'true',
        })
      );

      const status = String(intent?.status || '');
      const autorizado = status === 'succeeded';

      await (prisma as any).paymentTransaction.create({
        data: {
          companyId: params.companyId,
          orderId: params.orderId,
          gatewayId: gateway.id,
          provider: 'stripe',
          paymentMethod: 'credito',
          externalPaymentId: intent?.id || null,
          status: autorizado ? 'paid' : status || 'failed',
          amount: params.amount,
          paidAt: autorizado ? new Date() : null,
          gatewayResponse: intent || null,
        },
      });

      if (!autorizado) {
        // Cartao expirado, sem limite, ou que exige autenticacao do titular.
        return { ok: false, motivo: `Stripe retornou status ${status}`, externalPaymentId: intent?.id };
      }
      return { ok: true, externalPaymentId: intent?.id };
    } catch (error: any) {
      return { ok: false, motivo: String(error?.message || 'falha na cobranca').slice(0, 160) };
    }
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
      /** true em cobranca de mensalidade: guarda o cartao para os proximos ciclos. */
      saveCard?: boolean;
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
      // Quando a cobranca e de uma mensalidade, pedimos ao Stripe para guardar
      // o cartao e criar um cliente. E o que permite cobrar os proximos ciclos
      // sem o cliente precisar digitar o cartao de novo.
      ...(params.saveCard
        ? {
            customer_creation: 'always',
            'payment_intent_data[setup_future_usage]': 'off_session',
          }
        : {}),
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

  /**
   * Existe uma transacao nossa com esse id externo?
   *
   * Serve de porteiro dos webhooks: sem isso, qualquer id inventado fazia o
   * sistema sair chamando a API do gateway. Tambem evita responder erro para
   * evento de outra empresa, o que faria o gateway ficar reenviando.
   */
  private async localTransactionExists(companyId: string, provider: string, externalPaymentId: string) {
    const found = await (prisma as any).paymentTransaction.findFirst({
      where: { companyId, provider, externalPaymentId },
      select: { id: true },
    });
    return Boolean(found);
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

    // Sem janela de tempo, uma requisicao legitima capturada uma vez pode ser
    // reenviada para sempre. O Stripe recomenda 5 minutos.
    const toleranceSeconds = Math.max(30, Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SECONDS || 300));
    const eventAgeSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
    if (!Number.isFinite(eventAgeSeconds) || eventAgeSeconds > toleranceSeconds) {
      throw new PaymentServiceError('Assinatura Stripe fora da janela de tempo aceita', 400);
    }

    const payload = `${timestamp}.${rawBody}`;
    const digest = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

    // Comparacao em tempo constante: `!==` vaza, pelo tempo de resposta,
    // quantos caracteres do inicio ja batem.
    const digestBuffer = Buffer.from(digest, 'utf8');
    const expectedBuffer = Buffer.from(expectedV1, 'utf8');
    const confere =
      digestBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(digestBuffer, expectedBuffer);

    if (!confere) {
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

    // Antes a verificacao era condicional: sem webhook secret cadastrado, o
    // `if` passava reto e o payload era aceito como veio. Como o endpoint e
    // publico por natureza, isso equivalia a nao ter verificacao nenhuma para
    // toda empresa que ainda nao tinha preenchido o campo.
    const webhookSecret = decryptSecret(gateway.webhookSecretEncrypted || '');
    if (!webhookSecret) {
      throw new PaymentServiceError(
        'Webhook secret do Stripe nao configurado para esta empresa. ' +
          'Cadastre o secret em Gateways antes de receber notificacoes de pagamento.',
        400
      );
    }
    this.verifyStripeSignature(rawBody, signatureHeader || '', webhookSecret);

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

    // Evento que nao corresponde a nenhuma transacao nossa nao vira chamada
    // externa: sem esse porteiro, o endpoint publico vira um proxy para
    // consultar a API do Mercado Pago com o token da empresa.
    if (!(await this.localTransactionExists(companyId, 'mercadopago', String(paymentId)))) {
      return { received: true, ignored: true };
    }

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

    // O id que guardamos e o id do pedido no PagBank.
    if (!(await this.localTransactionExists(companyId, 'pagbank', String(externalId)))) {
      return { received: true, ignored: true };
    }

    // O status vem da API do PagBank, nunca do corpo da requisicao.
    //
    // O endpoint e publico e nao havia verificacao de assinatura: um POST com
    // {"id": "...", "status": "PAID"} dava o pedido por pago, quitava a
    // cobranca, somava no faturamento da empresa e ativava a mensalidade do
    // cliente. Agora o corpo serve so para saber QUAL pedido reconsultar —
    // quem responde se ele foi pago e o PagBank, com o token da empresa.
    const token = decryptSecret(gateway.secretKeyEncrypted || '');
    if (!token) throw new PaymentServiceError('Token PagBank nao configurado', 400);

    const env = String(gateway.environment || 'sandbox').toLowerCase();
    const host = env === 'producao' ? 'api.pagseguro.com' : 'sandbox.api.pagseguro.com';

    let order: JsonObject;
    try {
      order = await requestJson('GET', host, `/orders/${encodeURIComponent(String(externalId))}`, token);
    } catch (error: any) {
      // Pedido que o PagBank nao reconhece nao muda nada por aqui.
      if (error instanceof PaymentServiceError && error.statusCode === 404) {
        return { received: true, ignored: true };
      }
      throw error;
    }

    const charges: JsonObject[] = Array.isArray(order?.charges) ? order.charges : [];
    const chargePaga = charges.find((charge) =>
      ['PAID', 'COMPLETED'].includes(String(charge?.status || '').toUpperCase())
    );
    const statusRaw = chargePaga?.status || charges[0]?.status || order?.status || 'pending';

    const mapStatus: Record<string, string> = {
      PAID: 'paid',
      COMPLETED: 'paid',
      CANCELED: 'failed',
      DECLINED: 'failed',
      FAILED: 'failed',
    };

    const normalizedStatus = mapStatus[String(statusRaw).toUpperCase()] || String(statusRaw).toLowerCase();
    const paidAtRaw = chargePaga?.paid_at || chargePaga?.created_at;

    return this.finalizePaymentStatus({
      companyId,
      provider: 'pagbank',
      externalPaymentId: String(order?.id || externalId),
      newStatus: normalizedStatus,
      paidAt: normalizedStatus === 'paid' ? (paidAtRaw ? new Date(paidAtRaw) : new Date()) : null,
      webhookPayload: order,
    });
  }
}
