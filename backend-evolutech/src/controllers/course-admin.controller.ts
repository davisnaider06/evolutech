import { Response } from 'express';
import { CourseAdminError, CourseAdminService } from '../services/course-admin.service';
import { AuthedCourseManagerRequest } from '../types';

const service = new CourseAdminService();

export class CourseAdminController {
  private handleError(error: unknown, res: Response) {
    if (error instanceof CourseAdminError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro interno' });
  }

  async listCourses(req: AuthedCourseManagerRequest, res: Response) {
    try {
      const result = await service.listCourses(req.courseManager!);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async createCourse(req: AuthedCourseManagerRequest, res: Response) {
    try {
      const result = await service.createCourse(req.courseManager!, req.body || {});
      return res.status(201).json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async updateCourse(req: AuthedCourseManagerRequest, res: Response) {
    try {
      const result = await service.updateCourse(req.courseManager!, req.params.courseId, req.body || {});
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }

  async deleteCourse(req: AuthedCourseManagerRequest, res: Response) {
    try {
      const result = await service.deleteCourse(req.courseManager!, req.params.courseId);
      return res.json(result);
    } catch (error: unknown) {
      return this.handleError(error, res);
    }
  }
}
