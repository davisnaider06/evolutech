import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AdminController();

// --- BLINDAGEM DE SEGURANÇA ---
// Todas as rotas abaixo exigem Token Válido E ser SUPER_ADMIN
router.use(authenticateToken);
router.use(requireRoles(['SUPER_ADMIN_EVOLUTECH']));

// --- ROTAS DE MÓDULOS ---
// GET /api/admin/modulos
router.get('/modulos', controller.listModulos.bind(controller));
// POST /api/admin/modulos
router.post('/modulos', controller.createModulo.bind(controller));

// --- ROTAS DE SISTEMAS BASE ---
// GET /api/admin/sistemas-base
router.get('/sistemas-base', controller.listSistemasBase.bind(controller));
// POST /api/admin/sistemas-base
router.post('/sistemas-base', controller.createSistemaBase.bind(controller));

export default router;