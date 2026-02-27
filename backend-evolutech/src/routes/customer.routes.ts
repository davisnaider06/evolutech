import { Router } from 'express';
import { CustomerPortalController } from '../controllers/customer-portal.controller';
import { authenticateCustomerToken } from '../middlewares/auth.middleware';

const router = Router();
const controller = new CustomerPortalController();

router.use(authenticateCustomerToken);

router.get('/dashboard', controller.getDashboard.bind(controller));
router.get('/appointments', controller.listMyAppointments.bind(controller));
router.patch('/appointments/:appointmentId/cancel', controller.cancelMyAppointment.bind(controller));
router.get('/subscriptions', controller.listMySubscriptions.bind(controller));
router.get('/loyalty', controller.getMyLoyalty.bind(controller));
router.get('/courses', controller.listMyCourses.bind(controller));

export default router;
