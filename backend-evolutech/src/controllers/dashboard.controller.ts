import { Response } from 'express';
import { AuthedRequest } from '../types';
import { DashboardService, DashboardServiceError } from '../services/dashboard.service';

const service = new DashboardService();

export class DashboardController {
  async getMetrics(req: AuthedRequest, res: Response) {
    try {
      const data = await service.getMetrics(req.user!, req.query);
      return res.json(data);
    } catch (error: unknown) {
      if (error instanceof DashboardServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao carregar dashboard' });
    }
  }
}
