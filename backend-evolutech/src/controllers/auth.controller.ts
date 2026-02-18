import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthedRequest } from '../types';

const service = new AuthService();

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const data = await service.login(email, password);
      res.json(data);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  async me(req: AuthedRequest, res: Response) {
    try {
      const user = await service.getMe(req.user!.id);
      if (!user) {
         res.status(404).json({ error: 'Usuário não encontrado' });
         return;
      }
      res.json({
        user: {
          id: user.id,
          name: user.full_name,
          email: user.email,
          role: user.role,
          tenantId: user.company_id,
          tenantName: user.company_name
        },
        company: user.company_id ? { id: user.company_id, name: user.company_name } : null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}