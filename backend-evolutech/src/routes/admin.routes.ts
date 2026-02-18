import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AdminController();

router.use(authenticateToken); // Protege todas as rotas abaixo

router.get('/modulos', controller.getModulos.bind(controller));
router.post('/modulos', requireRoles(['SUPER_ADMIN_EVOLUTECH']), controller.createModulo.bind(controller));

router.get('/sistemas-base', controller.getSistemasBase.bind(controller));
router.post('/sistemas-base', requireRoles(['SUPER_ADMIN_EVOLUTECH']), controller.createSistemaBase.bind(controller));

export default router;