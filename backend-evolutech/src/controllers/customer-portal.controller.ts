import { Response } from 'express';
import { AuthedCustomerRequest } from '../types';
import { CustomerPortalError, CustomerPortalService } from '../services/customer-portal.service';

const service = new CustomerPortalService();

export class CustomerPortalController {
  private handleError(error: unknown, res: Response) {
    if (error instanceof CustomerPortalError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro interno' });
  }

  async getDashboard(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.getDashboard(req.customer!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listMyAppointments(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.listMyAppointments(req.customer!, req.query as any);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async getBookingOptions(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.getBookingOptions(req.customer!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async createMyAppointment(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.createMyAppointment(req.customer!, req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async cancelMyAppointment(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.cancelMyAppointment(req.customer!, req.params.appointmentId);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listMySubscriptions(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.listMySubscriptions(req.customer!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listAvailablePlans(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.listAvailablePlans(req.customer!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async subscribePlan(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.subscribePlan(req.customer!, req.params.planId);
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async getMyLoyalty(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.getMyLoyalty(req.customer!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listMyCourses(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.listMyCourses(req.customer!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listAvailableCourses(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.listAvailableCourses(req.customer!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async purchaseCourse(req: AuthedCustomerRequest, res: Response) {
    try {
      const result = await service.purchaseCourse(req.customer!, req.params.courseId);
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }
}
