import { Request, Response } from 'express';
import { AdminService } from '../services/admin.service';

const adminService = new AdminService();

export class AdminController {
  async listModulos(req: Request, res: Response) {
    try {
      const onlyActive = req.query.active === 'true';
      const modulos = await adminService.listModulos(onlyActive);
      return res.json(modulos);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Erro ao listar modulos' });
    }
  }

  async createModulo(req: Request, res: Response) {
    try {
      const { nome, codigo, preco_mensal, is_core, icone, descricao, status } = req.body;

      if (!nome || !codigo) {
        return res.status(400).json({ error: 'Nome e codigo sao obrigatorios' });
      }

      const modulo = await adminService.createModulo({
        nome,
        codigo,
        preco_mensal,
        is_core,
        icone,
        descricao,
        status: status || 'active'
      });

      return res.status(201).json(modulo);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Erro ao criar modulo' });
    }
  }

  async updateModulo(req: Request, res: Response) {
    try {
      const { moduloId } = req.params;
      const modulo = await adminService.updateModulo(moduloId, req.body || {});
      return res.json(modulo);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Erro ao atualizar modulo' });
    }
  }

  async deleteModulo(req: Request, res: Response) {
    try {
      const { moduloId } = req.params;
      await adminService.deleteModulo(moduloId);
      return res.status(204).send();
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Erro ao remover modulo' });
    }
  }

  async listSistemasBase(req: Request, res: Response) {
    try {
      const onlyActive = req.query.active === 'true';
      const sistemas = await adminService.listSistemasBase(onlyActive);
      return res.json(sistemas);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Erro ao listar sistemas' });
    }
  }

  async createSistemaBase(req: Request, res: Response) {
    try {
      const { nome, descricao, categoria, icone, modulosIds, status, nicho } = req.body;

      if (!nome) {
        return res.status(400).json({ error: 'Nome do sistema e obrigatorio' });
      }

      const sistema = await adminService.createSistemaBase({
        nome,
        descricao,
        categoria: categoria || nicho,
        icone,
        modulosIds,
        status
      });

      return res.status(201).json(sistema);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Erro ao criar sistema base' });
    }
  }

  async updateSistemaBase(req: Request, res: Response) {
    try {
      const { sistemaId } = req.params;
      const { nome, descricao, categoria, status, icone, nicho } = req.body || {};

      const sistema = await adminService.updateSistemaBase(sistemaId, {
        nome,
        descricao,
        categoria: categoria || nicho,
        status,
        icone
      });

      return res.json(sistema);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Erro ao atualizar sistema base' });
    }
  }

  async deleteSistemaBase(req: Request, res: Response) {
    try {
      const { sistemaId } = req.params;
      await adminService.deleteSistemaBase(sistemaId);
      return res.status(204).send();
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Erro ao remover sistema base' });
    }
  }

  async listSistemaBaseModulos(req: Request, res: Response) {
    try {
      const { sistemaId } = req.params;
      const items = await adminService.listSistemaBaseModulos(sistemaId);

      return res.json(items.map((item) => ({
        id: item.id,
        sistema_base_id: item.sistemaBaseId,
        modulo_id: item.moduloId,
        is_default: item.isMandatory,
        modulos: {
          id: item.modulo.id,
          nome: item.modulo.nome,
          codigo: item.modulo.codigo,
          descricao: item.modulo.descricao,
          is_core: item.modulo.isCore,
          preco_mensal: Number(item.modulo.precoMensal),
          status: item.modulo.status
        }
      })));
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Erro ao listar modulos do sistema' });
    }
  }

  async replaceSistemaBaseModulos(req: Request, res: Response) {
    try {
      const { sistemaId } = req.params;
      const { modulos } = req.body || {};

      if (!Array.isArray(modulos)) {
        return res.status(400).json({ error: 'Campo modulos deve ser um array' });
      }

      const items = await adminService.replaceSistemaBaseModulos(sistemaId, modulos);
      return res.json(items);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Erro ao salvar modulos do sistema' });
    }
  }

  async listTenants(req: Request, res: Response) {
    try {
      const companies = await adminService.listTenants();
      return res.json(
        companies.map((company) => {
          const owner = company.userRoles[0]?.user;
          return {
            id: company.id,
            name: company.name,
            slug: company.slug,
            plan: company.plan,
            status: company.status,
            monthly_revenue: Number(company.monthlyRevenue || 0),
            logo_url: company.logoUrl,
            sistema_base_id: company.sistemaBaseId,
            created_at: company.createdAt,
            updated_at: company.updatedAt,
            owner: owner
              ? {
                  id: owner.id,
                  name: owner.fullName,
                  email: owner.email
                }
              : null
          };
        })
      );
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Erro ao listar tenants' });
    }
  }

  async updateTenant(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
      const updated = await adminService.updateTenant(tenantId, req.body || {});
      return res.json(updated);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Erro ao atualizar tenant' });
    }
  }

  async deleteTenant(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
      await adminService.deleteTenant(tenantId);
      return res.status(204).send();
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Erro ao remover tenant' });
    }
  }
}
