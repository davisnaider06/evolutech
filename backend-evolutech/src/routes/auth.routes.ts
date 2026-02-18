import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AuthController();

router.post('/login', controller.login.bind(controller));
router.get('/me', authenticateToken, controller.me.bind(controller)); // Rota protegida

export default router;