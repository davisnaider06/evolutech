import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { loginRateLimit, passwordResetRateLimit } from '../middlewares/security.middleware';

const router = Router();
const controller = new AuthController();

router.post('/login', loginRateLimit, controller.login.bind(controller));
// Esqueci a senha: contador proprio (nao trava o login), porque disparam
// e-mail e aceitam tentativa de token.
router.post('/forgot-password', passwordResetRateLimit, controller.forgotPassword.bind(controller));
router.post('/reset-password', passwordResetRateLimit, controller.resetPassword.bind(controller));
router.get('/me', authenticateToken, controller.me.bind(controller)); // Rota protegida
// Edicao do proprio cadastro (nome e e-mail). Aberta a qualquer papel: o
// funcionario corrige o proprio nome sem precisar do dono.
router.put('/me', authenticateToken, controller.updateMe.bind(controller));
// Tambem limitado: a rota confere a senha atual, entao serve de oraculo.
router.post(
  '/change-password',
  loginRateLimit,
  authenticateToken,
  controller.changeMyPassword.bind(controller)
);

export default router;
