import { Response } from 'express';
import { AuthedRequest } from '../types';
import { CompanyService, CompanyServiceError } from '../services/company.service';

const service = new CompanyService();

export class CompanyController {
  private handleError(error: unknown, res: Response) {
    if (error instanceof CompanyServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    if (
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      typeof (error as any).statusCode === 'number'
    ) {
      const statusCode = Number((error as any).statusCode) || 500;
      const message = (error as any).message || 'Erro interno';
      return res.status(statusCode).json({ error: message });
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
      const result = await service.getFinancialOverview(req.user!, req.query as any);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async getReportsOverview(req: AuthedRequest, res: Response) {
    try {
      const result = await service.getReportsOverview(req.user!, req.query as any);
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

  async getCustomerHistory(req: AuthedRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const result = await service.getCustomerHistory(req.user!, customerId, req.query as any);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async getLoyaltySettings(req: AuthedRequest, res: Response) {
    try {
      const result = await service.getLoyaltySettings(req.user!, req.query as any);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async updateLoyaltySettings(req: AuthedRequest, res: Response) {
    try {
      const result = await service.updateLoyaltySettings(req.user!, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async getCustomerLoyaltyProfile(req: AuthedRequest, res: Response) {
    try {
      const { customerId } = req.params;
      const result = await service.getCustomerLoyaltyProfile(req.user!, customerId, req.query as any);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async previewPdvLoyalty(req: AuthedRequest, res: Response) {
    try {
      const result = await service.previewLoyaltyForCheckout(req.user!, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async previewPdvCheckout(req: AuthedRequest, res: Response) {
    try {
      const result = await service.previewPdvCheckout(req.user!, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listSubscriptionPlans(req: AuthedRequest, res: Response) {
    try {
      const result = await service.listSubscriptionPlans(req.user!, req.query as any);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async upsertSubscriptionPlan(req: AuthedRequest, res: Response) {
    try {
      const result = await service.upsertSubscriptionPlan(req.user!, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listCustomerSubscriptions(req: AuthedRequest, res: Response) {
    try {
      const result = await service.listCustomerSubscriptions(req.user!, req.query as any);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async upsertCustomerSubscription(req: AuthedRequest, res: Response) {
    try {
      const result = await service.upsertCustomerSubscription(req.user!, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listSubscriptionUsage(req: AuthedRequest, res: Response) {
    try {
      const result = await service.listSubscriptionUsage(req.user!, req.query as any);
      return res.json(result);
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

  async getPublicBookingOptions(req: AuthedRequest, res: Response) {
    try {
      const { slug } = req.params;
      const result = await service.getPublicBookingOptions(slug);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listPublicAppointmentsByDate(req: AuthedRequest, res: Response) {
    try {
      const { slug } = req.params;
      const result = await service.listPublicAppointmentsByDate(
        slug,
        String(req.query.date || ''),
        String(req.query.professional_id || '')
      );
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listPublicAvailableSlots(req: AuthedRequest, res: Response) {
    try {
      const { slug } = req.params;
      const result = await service.listPublicAvailableSlots(slug, {
        date: String(req.query.date || ''),
        service_id: String(req.query.service_id || ''),
        professional_id: String(req.query.professional_id || ''),
      });
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

  async listAppointmentAvailability(req: AuthedRequest, res: Response) {
    try {
      const result = await service.listAppointmentAvailability(req.user!, req.query as any);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async saveAppointmentAvailability(req: AuthedRequest, res: Response) {
    try {
      const { professionalId } = req.params;
      const result = await service.saveAppointmentAvailability(req.user!, professionalId, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listCommissionProfiles(req: AuthedRequest, res: Response) {
    try {
      const result = await service.listCommissionProfiles(req.user!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async upsertCommissionProfile(req: AuthedRequest, res: Response) {
    try {
      const { professionalId } = req.params;
      const result = await service.upsertCommissionProfile(req.user!, professionalId, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async createCommissionAdjustment(req: AuthedRequest, res: Response) {
    try {
      const result = await service.createCommissionAdjustment(req.user!, req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async getCommissionsOverview(req: AuthedRequest, res: Response) {
    try {
      const result = await service.getCommissionsOverview(req.user!, req.query as any);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async exportCommissionsExcel(req: AuthedRequest, res: Response) {
    try {
      const fileBuffer = await service.exportCommissionsExcel(req.user!, req.query as any);
      const month = String(req.query.month || '').trim() || new Date().toISOString().slice(0, 7);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="comissoes-${month}.xlsx"`
      );
      return res.status(200).send(fileBuffer);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async upsertCommissionPayout(req: AuthedRequest, res: Response) {
    try {
      const result = await service.upsertCommissionPayout(req.user!, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listCommissionPayouts(req: AuthedRequest, res: Response) {
    try {
      const result = await service.listCommissionPayouts(req.user!, req.query as any);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listBillingCharges(req: AuthedRequest, res: Response) {
    try {
      const result = await service.listBillingCharges(req.user!, req.query as any);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async createBillingCharge(req: AuthedRequest, res: Response) {
    try {
      const result = await service.createBillingCharge(req.user!, req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async listMyPaymentGateways(req: AuthedRequest, res: Response) {
    try {
      const result = await service.listMyPaymentGateways(req.user!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async connectMyPaymentGateway(req: AuthedRequest, res: Response) {
    try {
      const result = await service.connectMyPaymentGateway(req.user!, req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async activateMyPaymentGateway(req: AuthedRequest, res: Response) {
    try {
      const { gatewayId } = req.params;
      const result = await service.activateMyPaymentGateway(req.user!, gatewayId);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async deleteMyPaymentGateway(req: AuthedRequest, res: Response) {
    try {
      const { gatewayId } = req.params;
      const result = await service.deleteMyPaymentGateway(req.user!, gatewayId);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }
}
