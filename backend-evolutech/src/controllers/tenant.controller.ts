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
        donoNome,
        donoEmail,
        donoSenha,
        donoRole
      } = req.body ?? {};

      if (!empresaNome || !donoNome || !donoEmail || !sistemaBaseId) {
        return res.status(400).json({
          error: 'Campos obrigatórios: empresaNome, donoNome, donoEmail, sistemaBaseId'
        });
      }

      const result = await tenantService.onboardTenant({
        companyName: empresaNome,
        companyDocument: empresaDocumento,
        companyPlan: empresaPlano,
        companyStatus: empresaStatus,
        sistemaBaseId,
        ownerFullName: donoNome,
        ownerEmail: donoEmail,
        ownerPassword: donoSenha,
        ownerRole: donoRole
      });

      return res.status(201).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao criar tenant';

      if (
        message.includes('Campos obrigatórios') ||
        message.includes('não encontrado') ||
        message.includes('inativo') ||
        message.includes('Já existe usuário')
      ) {
        return res.status(400).json({ error: message });
      }

      return res.status(500).json({ error: message });
    }
  }
}
