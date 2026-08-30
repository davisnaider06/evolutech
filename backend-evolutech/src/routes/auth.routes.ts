import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { loginRateLimit } from '../middlewares/security.middleware';

const router = Router();
const controller = new AuthController();

router.post('/login', loginRateLimit, controller.login.bind(controller));
router.get('/me', authenticateToken, controller.me.bind(controller)); // Rota protegida
// Tambem limitado: a rota confere a senha atual, entao serve de oraculo.
router.post(
  '/change-password',
  loginRateLimit,
  authenticateToken,
  controller.changeMyPassword.bind(controller)
);

export default router;
