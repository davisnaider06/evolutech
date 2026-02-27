import { Request, Response } from 'express';
import { AuthedCustomerRequest } from '../types';
import { CustomerAuthError, CustomerAuthService } from '../services/customer-auth.service';

const service = new CustomerAuthService();

export class CustomerAuthController {
  private handleError(error: unknown, res: Response) {
    if (error instanceof CustomerAuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro interno' });
  }

  async register(req: Request, res: Response) {
    try {
      const result = await service.register(req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async login(req: Request, res: Response) {
    try {
      const result = await service.login(req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async me(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.me(req.customer!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }
}
