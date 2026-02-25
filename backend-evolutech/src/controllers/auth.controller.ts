import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthedRequest } from '../types';

const service = new AuthService();
const AUTH_PERF_DEBUG = process.env.AUTH_PERF_DEBUG === 'true';
const AUTH_SLOW_MS = Number(process.env.AUTH_SLOW_MS || 200);

export class AuthController {
  async login(req: Request, res: Response) {
    const startedAt = Date.now();
    try {
      const { email, password } = req.body;
      const data = await service.login(email, password);
      const elapsedMs = Date.now() - startedAt;

      if (AUTH_PERF_DEBUG) {
        res.setHeader('X-Auth-Login-Ms', String(elapsedMs));
      }
      if (elapsedMs > AUTH_SLOW_MS) {
        console.warn(`[auth.controller] slow login ${elapsedMs}ms email=${String(email || '').toLowerCase()}`);
      }

      res.json(data);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  async me(req: AuthedRequest, res: Response) {
    const startedAt = Date.now();
    try {
      const user = await service.getMe(req.user!.id);
      if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado' });
        return;
      }

      const elapsedMs = Date.now() - startedAt;
      if (AUTH_PERF_DEBUG) {
        res.setHeader('X-Auth-Me-Ms', String(elapsedMs));
        if (typeof (res.locals as any).authPerfMs === 'number') {
          res.setHeader('X-Auth-Middleware-Ms', String((res.locals as any).authPerfMs));
        }
      }
      if (elapsedMs > AUTH_SLOW_MS) {
        console.warn(`[auth.controller] slow me ${elapsedMs}ms userId=${req.user?.id}`);
      }

      res.json({
        user: {
          id: user.id,
          name: user.full_name,
          email: user.email,
          role: user.role,
          tenantId: user.company_id,
          tenantName: user.company_name,
          tenantSlug: user.company_slug,
          modules: user.modules,
        },
        company: user.company_id
          ? { id: user.company_id, name: user.company_name, slug: user.company_slug, modules: user.modules }
          : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
