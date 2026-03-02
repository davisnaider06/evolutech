import { Request, Response } from 'express';
import { PaymentService, PaymentServiceError } from '../services/payment.service';

const paymentService = new PaymentService();

export class PaymentController {
  async stripeWebhook(req: Request, res: Response) {
    try {
      const companyId = String(req.params.companyId || '').trim();
      if (!companyId) {
        return res.status(400).json({ error: 'companyId obrigatorio' });
      }

      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : JSON.stringify(req.body || {});
      const signature = String(req.headers['stripe-signature'] || '');

      const result = await paymentService.handleStripeWebhook(companyId, rawBody, signature);
      return res.json(result);
    } catch (error: any) {
      if (error instanceof PaymentServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(500).json({ error: error?.message || 'Erro interno no webhook' });
    }
  }

  async mercadoPagoWebhook(req: Request, res: Response) {
    try {
      const companyId = String(req.params.companyId || '').trim();
      if (!companyId) {
        return res.status(400).json({ error: 'companyId obrigatorio' });
      }

      const result = await paymentService.handleMercadoPagoWebhook(companyId, req.body || {});
      return res.json(result);
    } catch (error: any) {
      if (error instanceof PaymentServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(500).json({ error: error?.message || 'Erro interno no webhook' });
    }
  }

  async pagBankWebhook(req: Request, res: Response) {
    try {
      const companyId = String(req.params.companyId || '').trim();
      if (!companyId) {
        return res.status(400).json({ error: 'companyId obrigatorio' });
      }

      const result = await paymentService.handlePagBankWebhook(companyId, req.body || {});
      return res.json(result);
    } catch (error: any) {
      if (error instanceof PaymentServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(500).json({ error: error?.message || 'Erro interno no webhook' });
    }
  }
}
