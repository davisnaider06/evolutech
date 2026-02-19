import { Request, Response } from 'express';
import { AdminService } from '../services/admin.service';

const adminService = new AdminService();

export class AdminController {
  
  // --- MÓDULOS (Os blocos de construção) ---

  async listModulos(req: Request, res: Response) {
    try {
      const onlyActive = req.query.active === 'true';
      const modulos = await adminService.listModulos(onlyActive);
      return res.json(modulos);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Erro ao listar módulos' });
    }
  }

  async createModulo(req: Request, res: Response) {
    try {
      const { nome, codigo, preco_mensal, is_core, icone } = req.body;
      
      // Validação básica
      if (!nome || !codigo) {
        return res.status(400).json({ error: 'Nome e Código são obrigatórios' });
      }

      const modulo = await adminService.createModulo({
        nome,
        codigo,
        preco_mensal,
        is_core,
        icone,
        status: 'active'
      });

      return res.status(201).json(modulo);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Erro ao criar módulo' });
    }
  }

  // --- SISTEMAS BASE (Os produtos finais, ex: "Barbearia") ---

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
      const { nome, descricao, categoria, icone, modulosIds } = req.body;

      if (!nome) {
        return res.status(400).json({ error: 'Nome do sistema é obrigatório' });
      }

      const sistema = await adminService.createSistemaBase({
        nome,
        descricao,
        categoria,
        icone,
        modulosIds // Array de IDs dos módulos que compõem esse sistema
      });

      return res.status(201).json(sistema);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Erro ao criar sistema base' });
    }
  }
}