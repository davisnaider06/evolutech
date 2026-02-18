import { Response } from 'express';
import { AuthedRequest } from '../types';
import { CompanyService } from '../services/company.service';

const service = new CompanyService();

export class CompanyController {
  async list(req: AuthedRequest, res: Response) {
    try {
      const { table } = req.params;
      const result = await service.listTableData(table, req.user!, req.query);
      res.json(result);
    } catch (error: any) {
      const status = error.message.includes('Acesso negado') ? 403 : 500;
      res.status(status).json({ error: error.message });
    }
  }

  async create(req: AuthedRequest, res: Response) {
    try {
      const { table } = req.params;
      const result = await service.createRecord(table, req.user!, req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}