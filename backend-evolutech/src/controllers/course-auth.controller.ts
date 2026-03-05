import { Request, Response } from 'express';
import { CourseAuthError, CourseAuthService } from '../services/course-auth.service';
import { AuthedCourseManagerRequest } from '../types';

const service = new CourseAuthService();

export class CourseAuthController {
  private handleError(error: unknown, res: Response) {
    if (error instanceof CourseAuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro interno' });
  }

  async listCompanies(_req: Request, res: Response) {
    try {
      const result = await service.listCompanies();
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async register(req: Request, res: Response) {
    try {
      const result = await service.register(req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async login(req: Request, res: Response) {
    try {
      const result = await service.login(req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async me(req: AuthedCourseManagerRequest, res: Response) {
    try {
      const result = await service.me(req.courseManager!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }
}
