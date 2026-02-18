import { Response } from 'express';
import { AuthedRequest } from '../types';
import { AdminService } from '../services/admin.service';

const service = new AdminService();

export class AdminController {
  async getModulos(req: AuthedRequest, res: Response) {
    try {
      const onlyActive = req.user?.role !== 'SUPER_ADMIN_EVOLUTECH';
      const data = await service.listModulos(onlyActive);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async createModulo(req: AuthedRequest, res: Response) {
    try {
      const data = await service.createModulo(req.body);
      res.status(201).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getSistemasBase(req: AuthedRequest, res: Response) {
    try {
      const onlyActive = req.user?.role !== 'SUPER_ADMIN_EVOLUTECH';
      const data = await service.listSistemasBase(onlyActive);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async createSistemaBase(req: AuthedRequest, res: Response) {
    try {
      const data = await service.createSistemaBase(req.body);
      res.status(201).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}