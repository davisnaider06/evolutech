import { Router } from 'express';
import { CustomerAuthController } from '../controllers/customer-auth.controller';
import { authenticateCustomerToken } from '../middlewares/auth.middleware';

const router = Router();
const controller = new CustomerAuthController();

router.get('/companies', controller.listCompanies.bind(controller));
router.post('/register', controller.register.bind(controller));
router.post('/login', controller.login.bind(controller));
router.get('/me', authenticateCustomerToken, controller.me.bind(controller));

export default router;
