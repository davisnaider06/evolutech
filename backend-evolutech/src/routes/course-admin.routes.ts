import { Router } from 'express';
import { CourseAdminController } from '../controllers/course-admin.controller';
import { authenticateCourseManagerToken } from '../middlewares/auth.middleware';

const router = Router();
const controller = new CourseAdminController();

router.use(authenticateCourseManagerToken);

router.get('/courses', controller.listCourses.bind(controller));
router.post('/courses', controller.createCourse.bind(controller));
router.put('/courses/:courseId', controller.updateCourse.bind(controller));
router.delete('/courses/:courseId', controller.deleteCourse.bind(controller));

export default router;
