import { Response } from 'express';
import { AuthedRequest } from '../types';
import { CompanyService, CompanyServiceError } from '../services/company.service';

const service = new CompanyService();

export class CompanyController {
  private handleError(error: unknown, res: Response) {
    if (error instanceof CompanyServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Erro interno' });
  }

  async list(req: AuthedRequest, res: Response) {
    try {
      const { table } = req.params;
      const result = await service.listTableData(table, req.user!, req.query);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async create(req: AuthedRequest, res: Response) {
    try {
      const { table } = req.params;
      const result = await service.createRecord(table, req.user!, req.body);
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async update(req: AuthedRequest, res: Response) {
    try {
      const { table, id } = req.params;
      const result = await service.updateRecord(table, id, req.user!, req.body);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async remove(req: AuthedRequest, res: Response) {
    try {
      const { table, id } = req.params;
      const result = await service.deleteRecord(table, id, req.user!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listPdvProducts(req: AuthedRequest, res: Response) {
    try {
      const result = await service.listPdvProducts(req.user!, req.query);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async getFinancialOverview(req: AuthedRequest, res: Response) {
    try {
      const result = await service.getFinancialOverview(req.user!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async checkoutPdv(req: AuthedRequest, res: Response) {
    try {
      const result = await service.checkoutPdv(req.user!, req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async importProducts(req: AuthedRequest, res: Response) {
    try {
      const result = await service.importProducts(req.user!, req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async confirmPixPayment(req: AuthedRequest, res: Response) {
    try {
      const { orderId } = req.params;
      const result = await service.confirmPixPayment(req.user!, orderId, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listPdvOrders(req: AuthedRequest, res: Response) {
    try {
      const result = await service.listPdvOrders(req.user!, req.query as any);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listTeamMembers(req: AuthedRequest, res: Response) {
    try {
      const result = await service.listTeamMembers(req.user!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async createTeamMember(req: AuthedRequest, res: Response) {
    try {
      const { fullName, email, password } = req.body || {};
      const result = await service.createTeamMember(req.user!, { fullName, email, password });
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listMyTasks(req: AuthedRequest, res: Response) {
    try {
      const result = await service.listMyTasks(req.user!, req.query);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async createMyTask(req: AuthedRequest, res: Response) {
    try {
      const result = await service.createMyTask(req.user!, req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async updateMyTask(req: AuthedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const result = await service.updateMyTask(req.user!, taskId, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async deleteMyTask(req: AuthedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const result = await service.deleteMyTask(req.user!, taskId, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async moveMyTask(req: AuthedRequest, res: Response) {
    try {
      const { taskId } = req.params;
      const result = await service.moveMyTask(req.user!, taskId, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async getPublicBookingCompany(req: AuthedRequest, res: Response) {
    try {
      const { slug } = req.params;
      const result = await service.getPublicBookingCompany(slug);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listPublicAppointmentsByDate(req: AuthedRequest, res: Response) {
    try {
      const { slug } = req.params;
      const result = await service.listPublicAppointmentsByDate(slug, String(req.query.date || ''));
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async createPublicAppointment(req: AuthedRequest, res: Response) {
    try {
      const { slug } = req.params;
      const result = await service.createPublicAppointment(slug, req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }
}
