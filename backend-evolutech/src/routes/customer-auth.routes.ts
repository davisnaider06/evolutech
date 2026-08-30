import { Router } from 'express';
import { CustomerAuthController } from '../controllers/customer-auth.controller';
import { authenticateCustomerToken } from '../middlewares/auth.middleware';
import { loginRateLimit } from '../middlewares/security.middleware';

const router = Router();
const controller = new CustomerAuthController();

router.get('/companies', controller.listCompanies.bind(controller));
router.post('/register', loginRateLimit, controller.register.bind(controller));
router.post('/login', loginRateLimit, controller.login.bind(controller));
router.get('/me', authenticateCustomerToken, controller.me.bind(controller));

export default router;
