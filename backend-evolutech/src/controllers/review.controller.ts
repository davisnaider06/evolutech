import { Response } from 'express';
import { AuthedCustomerRequest, AuthedRequest } from '../types';
import { ReviewError, reviewService } from '../services/review.service';

export class ReviewController {
  private handleError(error: unknown, res: Response) {
    if (error instanceof ReviewError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro interno' });
  }

  async avaliar(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await reviewService.avaliar(req.customer!, req.params.appointmentId, req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async resumo(req: AuthedRequest, res: Response) {
    try {
      const result = await reviewService.resumo(req.user!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }
}
