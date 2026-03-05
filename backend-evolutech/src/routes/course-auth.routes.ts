import { Router } from 'express';
import { CourseAuthController } from '../controllers/course-auth.controller';
import { authenticateCourseManagerToken } from '../middlewares/auth.middleware';

const router = Router();
const controller = new CourseAuthController();

router.get('/companies', controller.listCompanies.bind(controller));
router.post('/register', controller.register.bind(controller));
router.post('/login', controller.login.bind(controller));
router.get('/me', authenticateCourseManagerToken, controller.me.bind(controller));

export default router;
