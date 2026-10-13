import { Router } from 'express';
import { CustomerAuthController } from '../controllers/customer-auth.controller';
import { authenticateCustomerToken } from '../middlewares/auth.middleware';
import { loginRateLimit, passwordResetRateLimit } from '../middlewares/security.middleware';

const router = Router();
const controller = new CustomerAuthController();

router.get('/companies', controller.listCompanies.bind(controller));
router.post('/register', loginRateLimit, controller.register.bind(controller));
router.post('/login', loginRateLimit, controller.login.bind(controller));
router.post('/forgot-password', passwordResetRateLimit, controller.forgotPassword.bind(controller));
router.post('/reset-password', passwordResetRateLimit, controller.resetPassword.bind(controller));
router.get('/me', authenticateCustomerToken, controller.me.bind(controller));

export default router;
