import { Request, Response } from 'express';
import { TenantService } from '../services/tenant.service';

const tenantService = new TenantService();

export class TenantController {
  async createTenant(req: Request, res: Response) {
    try {
      const {
        empresaNome,
        empresaDocumento,
        empresaPlano,
        empresaStatus,
        sistemaBaseId,
        ownerFullName,
        ownerEmail,
        ownerPassword,
      } = req.body ?? {};

      if (!empresaNome || !sistemaBaseId) {
        return res.status(400).json({
          error: 'Campos obrigatorios: empresaNome, sistemaBaseId',
        });
      }

      const result = await tenantService.onboardTenant({
        companyName: empresaNome,
        companyDocument: empresaDocumento,
        companyPlan: empresaPlano,
        companyStatus: empresaStatus,
        sistemaBaseId,
        ownerFullName,
        ownerEmail,
        ownerPassword,
      });

      return res.status(201).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao criar tenant';
      if (message.toLowerCase().includes('obrigatorio') || message.toLowerCase().includes('nao encontrado') || message.toLowerCase().includes('inativo')) {
        return res.status(400).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  }
}
